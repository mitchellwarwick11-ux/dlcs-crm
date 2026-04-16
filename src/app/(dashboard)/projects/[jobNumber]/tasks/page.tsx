import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TaskCard } from '@/components/tasks/task-card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

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

  // Get tasks with their staff assignments
  const { data: tasks } = await db
    .from('project_tasks')
    .select(`
      id, title, description, status, fee_type, quoted_amount, claimed_amount, due_date, sort_order,
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
  const taskIds = (tasks ?? []).map((task: any) => task.id)

  if (taskIds.length > 0) {
    const { data: invoiceItems } = await db
      .from('invoice_items')
      .select(`
        task_id,
        amount,
        invoices!inner(status)
      `)
      .in('task_id', taskIds)

    for (const item of (invoiceItems ?? [])) {
      if (!item.task_id) continue

      const invoiceStatus = Array.isArray(item.invoices)
        ? item.invoices[0]?.status
        : item.invoices?.status

      if (invoiceStatus === 'cancelled') continue

      invoicedMap[item.task_id] = (invoicedMap[item.task_id] ?? 0) + (item.amount ?? 0)
    }
  }

  const taskList = tasks ?? []
  const completedCount = taskList.filter((t: any) => t.status === 'completed').length

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {taskList.map((task: any) => {
            const assignedStaff = (task.task_assignments ?? [])
              .map((a: any) => a.staff_profiles)
              .filter(Boolean)

            return (
              <TaskCard
                key={task.id}
                task={task}
                assignedStaff={assignedStaff}
                workDone={workDoneMap[task.id] ?? 0}
                invoiced={invoicedMap[task.id] ?? 0}
                jobNumber={jobNumber}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
