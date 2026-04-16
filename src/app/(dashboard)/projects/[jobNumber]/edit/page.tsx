import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectEditForm } from '@/components/projects/project-edit-form'
import { DeleteJobButton } from '@/components/projects/delete-job-button'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ jobNumber: string }>
}) {
  const { jobNumber } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: project },
    { data: clients },
    { data: staff },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('*, project_contacts(*)')
      .eq('job_number', jobNumber)
      .returns<any[]>()
      .single(),
    supabase.from('clients').select('*').eq('is_active', true).order('name'),
    supabase.from('staff_profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
  ])

  if (!project) notFound()

  const p = project as any
  const primaryContact = (p.project_contacts as any[])?.find((c: any) => c.is_primary) ?? null

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Edit Job {jobNumber}</h1>
          <p className="text-sm text-slate-500 mt-1">Update job details, contact and site information.</p>
        </div>
        <DeleteJobButton projectId={p.id} jobNumber={jobNumber} />
      </div>
      <ProjectEditForm
        project={p}
        primaryContact={primaryContact}
        clients={clients ?? []}
        staff={staff ?? []}
      />
    </div>
  )
}
