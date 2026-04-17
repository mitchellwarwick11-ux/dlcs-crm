import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils/formatters'
import { USER_ROLES } from '@/lib/constants/roles'
import type { UserRole } from '@/types/database'
import { JobStaffRatesPanel } from '@/components/projects/job-staff-rates-panel'

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-900">{value}</p>
    </div>
  )
}

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ jobNumber: string }>
}) {
  const { jobNumber } = await params
  const supabase = await createClient()

  const db = supabase as any

  const { data: project } = await supabase
    .from('projects')
    .select(`
      *,
      clients(name, company_name, email, phone, address_line1, address_line2, suburb, state, postcode),
      job_manager:staff_profiles!job_manager_id(full_name, role),
      project_contacts(*)
    `)
    .eq('job_number', jobNumber)
    .returns<any[]>()
    .single()

  if (!project) notFound()

  const p = project as any
  const client = p.clients
  const manager = p.job_manager
  const contacts = (p.project_contacts as any[]) ?? []

  const [{ data: activeStaff }, { data: staffRateOverrides }] = await Promise.all([
    db.from('staff_profiles')
      .select('id, full_name, role, default_hourly_rate')
      .eq('is_active', true)
      .order('full_name'),
    db.from('project_staff_rates')
      .select('id, staff_id, hourly_rate')
      .eq('project_id', p.id),
  ])

  const clientAddress = [
    client?.address_line1,
    client?.address_line2,
    client?.suburb,
    client?.state,
    client?.postcode,
  ].filter(Boolean).join(', ')

  return (
    <div className="p-8 space-y-6 max-w-4xl">

      {/* Job Info */}
      <Card>
        <CardHeader><CardTitle>Job Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          <InfoRow label="Job Number" value={project.job_number} />
          <InfoRow label="Created" value={formatDate(project.created_at)} />
          <InfoRow label="Job Manager" value={manager ? `${manager.full_name} (${USER_ROLES[manager.role as UserRole]})` : null} />
          <InfoRow label="Site Address" value={[project.site_address, project.suburb].filter(Boolean).join(', ')} />
          <InfoRow label="Lot Number" value={project.lot_number} />
          <InfoRow label="Section Number" value={project.section_number} />
          <InfoRow label="Plan Number" value={project.plan_number} />
          <InfoRow label="LGA" value={project.lga} />
          <InfoRow label="Parish" value={project.parish} />
          <InfoRow label="County" value={project.county} />
          {project.description && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Notes</p>
              <p className="text-sm text-slate-900 whitespace-pre-wrap">{project.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client */}
      {client && (
        <Card>
          <CardHeader><CardTitle>Client</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
            <div className="col-span-2 md:col-span-3">
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Name</p>
              <p className="text-sm font-semibold text-slate-900">{client.company_name ?? client.name}</p>
              {client.company_name && <p className="text-sm text-slate-500">{client.name}</p>}
            </div>
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
            {clientAddress && (
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Address</p>
                <p className="text-sm text-slate-900">{clientAddress}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Primary Contact */}
      {contacts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Contacts</CardTitle></CardHeader>
          <CardContent className="divide-y divide-slate-100">
            {contacts.map((c: any) => (
              <div key={c.id} className="py-3 first:pt-0 last:pb-0 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{c.name}</p>
                  {c.role && <p className="text-xs text-slate-500">{c.role}</p>}
                  {c.is_primary && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Primary</span>}
                </div>
                {c.email && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Email</p>
                    <a href={`mailto:${c.email}`} className="text-sm text-blue-600 hover:underline">{c.email}</a>
                  </div>
                )}
                {c.phone && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Phone</p>
                    <a href={`tel:${c.phone}`} className="text-sm text-slate-900 hover:underline">{c.phone}</a>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Staff Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Rates</CardTitle>
          <p className="text-sm text-slate-500 mt-0.5">
            Job-specific hourly rate overrides. Leave blank to use the standard rate from Settings.
          </p>
        </CardHeader>
        <CardContent>
          <JobStaffRatesPanel
            projectId={p.id}
            staff={activeStaff ?? []}
            overrides={staffRateOverrides ?? []}
          />
        </CardContent>
      </Card>

    </div>
  )
}
