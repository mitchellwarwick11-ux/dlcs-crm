import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TaskForm } from '@/components/tasks/task-form'

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ jobNumber: string }>
}) {
  const { jobNumber } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const [{ data: project }, { data: staff }, { data: roleRates }] = await Promise.all([
    db.from('projects').select('id').eq('job_number', jobNumber).single(),
    db.from('staff_profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
    db.from('role_rates').select('*').order('sort_order'),
  ])

  if (!project) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Add Task</h2>
        <p className="text-sm text-slate-500 mt-1">Create a new task for job {jobNumber}.</p>
      </div>
      <TaskForm
        mode="create"
        projectId={project.id}
        jobNumber={jobNumber}
        staff={staff ?? []}
        roleRates={roleRates ?? []}
      />
    </div>
  )
}
