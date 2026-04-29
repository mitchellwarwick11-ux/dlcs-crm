import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { addDays, format, startOfWeek, subWeeks } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { TasksView } from '@/components/tasks/tasks-view'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { ScheduleEntryFull } from '@/types/database'

export default async function TasksPage({
  params,
}: {
  params: Promise<{ jobNumber: string }>
}) {
  const { jobNumber } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  // Get project
  const { data: project } = await db
    .from('projects')
    .select('id, job_number')
    .eq('job_number', jobNumber)
    .single()

  if (!project) notFound()

  // Get tasks with their staff assignments and source quote (if accepted from one)
  const { data: tasks } = await db
    .from('project_tasks')
    .select(`
      id, title, description, status, fee_type, quoted_amount, claimed_amount, due_date, sort_order,
      approval_approved_by, approval_method, approval_date,
      approval_prepared_by_profile:staff_profiles!approval_prepared_by ( full_name ),
      quote:quotes!quote_id ( quote_number, contact_name, approved_at, created_by_profile:staff_profiles!created_by ( full_name ) ),
      task_assignments ( staff_id, staff_profiles ( id, full_name ) )
    `)
    .eq('project_id', project.id)
    .order('sort_order')

  // Get only uninvoiced time entries so WIP reflects work not yet billed
  const { data: timeEntries } = await db
    .from('time_entries')
    .select('task_id, hours, rate_at_time')
    .eq('project_id', project.id)
    .is('invoice_item_id', null)

  // Build work done map: task_id → total $ value of time
  const workDoneMap: Record<string, number> = {}
  for (const entry of (timeEntries ?? [])) {
    if (!entry.task_id) continue
    workDoneMap[entry.task_id] = (workDoneMap[entry.task_id] ?? 0) + (entry.hours * entry.rate_at_time)
  }

  // Invoiced amounts — will be wired up once invoicing is built
  // For now all tasks show $0 invoiced
  const invoicedMap: Record<string, number> = {}
  type InvoiceLink = { id: string; invoice_number: string; status: string; amount: number }
  const invoicesByTaskMap: Record<string, InvoiceLink[]> = {}
  const taskIds = (tasks ?? []).map((task: any) => task.id)

  if (taskIds.length > 0) {
    const { data: invoiceItems } = await db
      .from('invoice_items')
      .select(`
        task_id,
        amount,
        invoices!inner(id, invoice_number, status)
      `)
      .in('task_id', taskIds)

    for (const item of (invoiceItems ?? [])) {
      if (!item.task_id) continue

      const invObj = Array.isArray(item.invoices) ? item.invoices[0] : item.invoices
      const invoiceStatus = invObj?.status

      if (invoiceStatus === 'cancelled') continue

      invoicedMap[item.task_id] = (invoicedMap[item.task_id] ?? 0) + (item.amount ?? 0)

      if (invObj?.id) {
        const list = invoicesByTaskMap[item.task_id] ?? []
        const existing = list.find(l => l.id === invObj.id)
        if (existing) {
          existing.amount += (item.amount ?? 0)
        } else {
          list.push({
            id: invObj.id,
            invoice_number: invObj.invoice_number,
            status: invObj.status,
            amount: item.amount ?? 0,
          })
        }
        invoicesByTaskMap[item.task_id] = list
      }
    }
  }

  const taskList = tasks ?? []
  const completedCount = taskList.filter((t: any) => t.status === 'completed').length

  // Window for the availability calendar shown inside the schedule modal
  const calStart = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1)
  const calEnd   = addDays(calStart, 7 * 8) // ~8 weeks of look-ahead
  const calStartStr = format(calStart, 'yyyy-MM-dd')
  const calEndStr   = format(calEnd, 'yyyy-MM-dd')

  // Data for the "Schedule field work" modal launched from a task card
  const [
    { data: scheduleProjects },
    { data: fieldSurveyors },
    { data: officeSurveyors },
    { data: scheduleAllTasks },
    { data: equipment },
    { data: allStaff },
    { data: viewerProfile },
    { data: rawScheduleEntries },
    { data: scheduleSurveyorLinks },
  ] = await Promise.all([
    db.from('projects')
      .select(`
        id, job_number, title, site_address, suburb,
        clients ( name, company_name ),
        job_manager:staff_profiles!job_manager_id ( full_name )
      `)
      .in('status', ['active', 'on_hold'])
      .order('job_number', { ascending: false }),
    db.from('staff_profiles')
      .select('id, full_name')
      .eq('role', 'field_surveyor')
      .eq('is_active', true)
      .order('full_name'),
    db.from('staff_profiles')
      .select('id, full_name')
      .in('role', ['office_surveyor', 'registered_surveyor'])
      .eq('is_active', true)
      .order('full_name'),
    db.from('project_tasks')
      .select('id, project_id, title')
      .not('status', 'in', '("completed","cancelled")')
      .order('title'),
    db.from('schedule_equipment')
      .select('id, label')
      .eq('is_active', true)
      .order('sort_order'),
    db.from('staff_profiles')
      .select('id, full_name, role')
      .eq('is_active', true)
      .order('full_name'),
    db.from('staff_profiles')
      .select('access_level')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle(),
    db.from('field_schedule_entries')
      .select('id, date, hours, time_of_day, status, project_id, task_id')
      .gte('date', calStartStr)
      .lte('date', calEndStr)
      .order('date'),
    db.from('field_schedule_surveyors')
      .select('entry_id, staff_profiles ( id, full_name )'),
  ])

  // Merge surveyor links into entries for the availability calendar
  const surveyorMap = new Map<string, { id: string; full_name: string }[]>()
  for (const link of (scheduleSurveyorLinks ?? [])) {
    const sp = (link as any).staff_profiles
    if (!sp) continue
    const arr = surveyorMap.get((link as any).entry_id) ?? []
    arr.push({ id: sp.id, full_name: sp.full_name })
    surveyorMap.set((link as any).entry_id, arr)
  }
  const allScheduleEntries: ScheduleEntryFull[] = ((rawScheduleEntries ?? []) as any[]).map(e => ({
    ...e,
    notes: null,
    office_surveyor_id: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    projects: null,
    project_tasks: null,
    office_surveyor: null,
    field_surveyors: surveyorMap.get(e.id) ?? [],
    resources: [],
  }))

  const canEditSchedule =
    viewerProfile?.access_level === 'project_manager' ||
    viewerProfile?.access_level === 'admin'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {taskList.length} task{taskList.length !== 1 ? 's' : ''}
            {taskList.length > 0 && ` · ${completedCount} completed`}
          </p>
        </div>
        <Link href={`/projects/${jobNumber}/tasks/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </Link>
      </div>

      {taskList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <p className="text-sm text-slate-500">No tasks yet.</p>
          <Link href={`/projects/${jobNumber}/tasks/new`}>
            <Button variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add first task
            </Button>
          </Link>
        </div>
      ) : (
        <TasksView
          projectId={project.id}
          jobNumber={jobNumber}
          tasks={taskList}
          workDoneMap={workDoneMap}
          invoicedMap={invoicedMap}
          invoicesByTaskMap={invoicesByTaskMap}
          scheduleProjects={(scheduleProjects ?? []) as any}
          scheduleAllTasks={(scheduleAllTasks ?? []) as any}
          fieldSurveyors={(fieldSurveyors ?? []) as any}
          officeSurveyors={(officeSurveyors ?? []) as any}
          equipment={(equipment ?? []) as any}
          allStaff={(allStaff ?? []) as any}
          canEditSchedule={canEditSchedule}
          allScheduleEntries={allScheduleEntries}
        />
      )}
    </div>
  )
}
