import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { JOB_TYPES } from '@/lib/constants/job-types'
import { formatDate } from '@/lib/utils/formatters'
import { Pencil, Plus } from 'lucide-react'
import type { JobType, ProjectStatus } from '@/types/database'

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-900">{value}</p>
    </div>
  )
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const [{ data: client }, { data: projects }] = await Promise.all([
    db.from('clients').select('*').eq('id', id).single(),
    db
      .from('projects')
      .select('id, job_number, title, status, job_type, created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!client) notFound()

  const address = [
    client.address_line1,
    client.address_line2,
    client.suburb,
    client.state,
    client.postcode,
  ].filter(Boolean).join(', ')

  return (
    <div className="p-8 max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {client.company_name ?? client.name}
          </h1>
          {client.company_name && (
            <p className="text-sm text-slate-500 mt-0.5">{client.name}</p>
          )}
          {!client.is_active && (
            <span className="inline-block mt-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>
          )}
        </div>
        <Link href={`/clients/${id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            Edit Client
          </Button>
        </Link>
      </div>

      {/* Contact Details */}
      <Card>
        <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          <InfoRow label="Contact Name" value={client.name} />
          {client.company_name && <InfoRow label="Company" value={client.company_name} />}
          {client.email && (
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Email</p>
              <a href={`mailto:${client.email}`} className="text-sm text-blue-600 hover:underline">{client.email}</a>
            </div>
          )}
          {client.phone && (
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Phone</p>
              <a href={`tel:${client.phone}`} className="text-sm text-slate-900 hover:underline">{client.phone}</a>
            </div>
          )}
          {address && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Address</p>
              <p className="text-sm text-slate-900">{address}</p>
            </div>
          )}
          {client.notes && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Notes</p>
              <p className="text-sm text-slate-900 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Jobs ({projects?.length ?? 0})</CardTitle>
          <Link href={`/projects/new`}>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Job
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {!projects || projects.length === 0 ? (
            <p className="text-sm text-slate-500">No jobs linked to this client.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {projects.map((project: any) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.job_number}/details`}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:bg-slate-50 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-900">{project.job_number}</span>
                      <ProjectStatusBadge status={project.status as ProjectStatus} />
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{project.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">{JOB_TYPES[project.job_type as JobType]}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(project.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
