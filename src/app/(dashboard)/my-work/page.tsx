import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MyWorkBoard } from '@/components/my-work/my-work-board'

export default async function MyWorkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  // Get current user's profile
  const { data: myProfile } = await db
    .from('staff_profiles')
    .select('id, full_name, access_level, default_hourly_rate')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()

  if (!myProfile) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-amber-800 font-medium">No staff profile found for {user.email}</p>
          <p className="text-amber-600 text-sm mt-1">Ask an admin to create a staff profile matching your email address.</p>
        </div>
      </div>
    )
  }

  // Parallel data fetches
  const [
    { data: itemAssignments },
    { data: timeEntries },
    { data: activeProjects },
    { data: projectRates },
    { data: allActiveTasks },
  ] = await Promise.all([
    // 1. My assigned items (with full hierarchy: item → task → project → client)
    db.from('task_item_assignments')
      .select(`
        id,
        task_items (
          id, title, description, status, due_date, sort_order, task_id,
          project_tasks (
            id, title, status, fee_type, project_id,
            projects (
              id, job_number, title, status,
              clients ( name, company_name )
            )
          )
        )
      `)
      .eq('staff_id', myProfile.id),

    // 2. My time entries (for per-task hours aggregation)
    db.from('time_entries')
      .select('task_id, hours')
      .eq('staff_id', myProfile.id),

    // 3. Active projects for add-item form
    db.from('projects')
      .select('id, job_number, title, clients ( name, company_name )')
      .in('status', ['active', 'on_hold'])
      .order('job_number', { ascending: false }),

    // 4. Project-specific rate overrides for this user (for inline time log)
    db.from('project_staff_rates')
      .select('project_id, hourly_rate')
      .eq('staff_id', myProfile.id),

    // 5. All active tasks (for add-item form's Task dropdown)
    db.from('project_tasks')
      .select('id, project_id, title, fee_type')
      .not('status', 'in', '("completed","cancelled")')
      .order('title'),
  ])

  // Aggregate hours by task_id
  const hoursMap = new Map<string, number>()
  for (const te of (timeEntries ?? [])) {
    if (!te.task_id) continue
    hoursMap.set(te.task_id, (hoursMap.get(te.task_id) ?? 0) + Number(te.hours ?? 0))
  }

  // Flatten items from assignments
  const items = (itemAssignments ?? [])
    .filter((a: any) => a.task_items?.project_tasks?.projects)
    .map((a: any) => {
      const item = a.task_items
      const task = item.project_tasks
      const proj = task.projects
      const client = proj.clients
      return {
        itemId: item.id,
        title: item.title,
        description: item.description,
        status: item.status,
        dueDate: item.due_date,
        sortOrder: item.sort_order,
        taskId: task.id,
        taskTitle: task.title,
        taskStatus: task.status,
        taskFeeType: task.fee_type,
        projectId: proj.id,
        jobNumber: proj.job_number,
        projectTitle: proj.title,
        projectStatus: proj.status,
        clientName: client ? (client.company_name ?? client.name) : null,
        taskHoursLogged: hoursMap.get(task.id) ?? 0,
      }
    })

  return (
    <MyWorkBoard
      myProfile={{
        id: myProfile.id,
        fullName: myProfile.full_name,
        defaultHourlyRate: myProfile.default_hourly_rate ?? 0,
      }}
      items={items}
      activeProjects={(activeProjects ?? []).map((p: any) => ({
        id: p.id,
        jobNumber: p.job_number,
        title: p.title,
        clientName: p.clients ? (p.clients.company_name ?? p.clients.name) : null,
      }))}
      activeTasks={(allActiveTasks ?? []).map((t: any) => ({
        id: t.id,
        projectId: t.project_id,
        title: t.title,
        feeType: t.fee_type,
      }))}
      projectRates={(projectRates ?? []).map((r: any) => ({
        projectId: r.project_id,
        hourlyRate: r.hourly_rate,
      }))}
    />
  )
}
