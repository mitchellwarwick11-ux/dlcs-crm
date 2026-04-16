import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, ShieldCheck } from 'lucide-react'
import { JsaForm } from '@/components/field/jsa-form'

const ROLE_LABELS: Record<string, string> = {
  field_surveyor:       'Field Surveyor',
  office_surveyor:      'Office Surveyor',
  registered_surveyor:  'Registered Surveyor',
  administration:       'Administration',
  drafting:             'Drafting',
  sewer_water_designer: 'Sewer & Water Designer',
}

export default async function SafetyPage({
  params,
}: {
  params: Promise<{ entryId: string }>
}) {
  const { entryId } = await params
  const supabase = await createClient()
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffProfile } = await db
    .from('staff_profiles')
    .select('id, full_name, role')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()

  if (!staffProfile) redirect('/field')

  const { data: entry } = await db
    .from('field_schedule_entries')
    .select('id, date, projects ( job_number, site_address, suburb )')
    .eq('id', entryId)
    .maybeSingle()

  if (!entry) notFound()

  // Load existing submission for re-editing
  const { data: existing } = await db
    .from('jsa_submissions')
    .select('specific_swms_required, selected_tasks, additional_hazards, signature_data')
    .eq('entry_id', entryId)
    .eq('staff_id', staffProfile.id)
    .maybeSingle()

  const proj     = entry.projects
  const jobLabel = proj?.job_number ?? entryId.slice(0, 8)
  const roleLabel = ROLE_LABELS[staffProfile.role] ?? staffProfile.role

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-safe-top">
        <div className="flex items-center gap-2 py-3">
          <Link
            href={`/field/${entryId}`}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ShieldCheck className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-xs text-slate-500 font-medium">{jobLabel}</p>
              <h1 className="text-base font-bold text-slate-900">Risk Assessment</h1>
            </div>
          </div>
          {existing && (
            <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-1 rounded-full">
              Re-submitting
            </span>
          )}
        </div>
      </div>

      <JsaForm
        entryId={entryId}
        staffId={staffProfile.id}
        staffName={staffProfile.full_name}
        staffRole={roleLabel}
        jobNumber={jobLabel}
        existing={existing}
      />
    </div>
  )
}
