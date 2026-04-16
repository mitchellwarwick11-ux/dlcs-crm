import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TaskForm } from '@/components/tasks/task-form'

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ jobNumber: string; taskId: string }>
}) {
  const { jobNumber, taskId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const [{ data: project }, { data: task }, { data: staff }, { data: roleRates }, { data: assignments }] = await Promise.all([
    db.from('projects').select('id').eq('job_number', jobNumber).single(),
    db.from('project_tasks').select('*').eq('id', taskId).single(),
    db.from('staff_profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
    db.from('role_rates').select('*').order('sort_order'),
    db.from('task_assignments').select('staff_id').eq('task_id', taskId),
  ])

  if (!project || !task) notFound()

  const initialStaffIds = (assignments ?? []).map((a: any) => a.staff_id)

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Edit Task</h2>
        <p className="text-sm text-slate-500 mt-1">{task.title}</p>
      </div>
      <TaskForm
        mode="edit"
        projectId={project.id}
        jobNumber={jobNumber}
        taskId={taskId}
        staff={staff ?? []}
        roleRates={roleRates ?? []}
        initialStaffIds={initialStaffIds}
        initialValues={{
          title: task.title,
          description: task.description ?? '',
          fee_type: task.fee_type ?? 'hourly',
          quoted_amount: task.quoted_amount ?? null,
          due_date: task.due_date ?? null,
          status: task.status,
        }}
      />
    </div>
  )
}
