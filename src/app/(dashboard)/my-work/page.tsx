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
    { data: assignments },
    { data: timeEntries },
    { data: activeProjects },
    { data: projectRates },
    { data: allProjectTasks },
  ] = await Promise.all([
    // 1. My assigned tasks with project + client info
    db.from('task_assignments')
      .select(`
        id, estimated_hours,
        project_tasks (
          id, title, description, status, fee_type, quoted_amount, due_date,
          project_id,
          projects (
            id, job_number, title, status,
            clients ( name, company_name )
          )
        )
      `)
      .eq('staff_id', myProfile.id),

    // 2. My time entries (for hours aggregation per task)
    db.from('time_entries')
      .select('task_id, hours')
      .eq('staff_id', myProfile.id),

    // 3. Active projects for quick-add dropdown
    db.from('projects')
      .select('id, job_number, title, clients ( name, company_name )')
      .in('status', ['active', 'on_hold'])
      .order('job_number', { ascending: false }),

    // 4. Project-specific rate overrides for this user
    db.from('project_staff_rates')
      .select('project_id, hourly_rate')
      .eq('staff_id', myProfile.id),

    // 5. All active tasks for active projects (for "select existing task" in quick-add)
    db.from('project_tasks')
      .select('id, project_id, title, status, fee_type, due_date, description')
      .not('status', 'in', '("completed","cancelled")')
      .order('title'),
  ])

  // Aggregate hours by task_id
  const hoursMap = new Map<string, number>()
  for (const te of (timeEntries ?? [])) {
    if (!te.task_id) continue
    hoursMap.set(te.task_id, (hoursMap.get(te.task_id) ?? 0) + Number(te.hours ?? 0))
  }

  // Flatten task_assignments into MyTask[]
  const tasks = (assignments ?? [])
    .filter((a: any) => a.project_tasks?.projects)
    .map((a: any) => {
      const t = a.project_tasks
      const p = t.projects
      const c = p.clients
      return {
        taskId: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        feeType: t.fee_type,
        dueDate: t.due_date,
        projectId: p.id,
        jobNumber: p.job_number,
        projectTitle: p.title,
        projectStatus: p.status,
        clientName: c ? (c.company_name ?? c.name) : null,
        totalHoursLogged: hoursMap.get(t.id) ?? 0,
      }
    })

  return (
    <MyWorkBoard
      myProfile={{
        id: myProfile.id,
        fullName: myProfile.full_name,
        defaultHourlyRate: myProfile.default_hourly_rate ?? 0,
      }}
      tasks={tasks}
      activeProjects={(activeProjects ?? []).map((p: any) => ({
        id: p.id,
        jobNumber: p.job_number,
        title: p.title,
        clientName: p.clients ? (p.clients.company_name ?? p.clients.name) : null,
      }))}
      projectRates={(projectRates ?? []).map((r: any) => ({
        projectId: r.project_id,
        hourlyRate: r.hourly_rate,
      }))}
      allProjectTasks={(allProjectTasks ?? []).map((t: any) => ({
        id: t.id,
        projectId: t.project_id,
        title: t.title,
        status: t.status,
        feeType: t.fee_type,
        dueDate: t.due_date,
        description: t.description,
      }))}
    />
  )
}
