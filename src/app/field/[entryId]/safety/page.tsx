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
    <div className="flex flex-col flex-1 bg-[#F5F4F1]">
      {/* Header — charcoal */}
      <div className="bg-[#2F2F33] px-4 pt-safe-top">
        <div className="flex items-center gap-2 py-3">
          <Link
            href={`/field/${entryId}`}
            className="p-1.5 -ml-1.5 rounded-lg text-[#BDBDC0] hover:bg-[#45454B] transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#F39200] font-bold tracking-[0.18em]">{jobLabel}</p>
            <h1 className="text-base font-bold text-white">Risk Assessment</h1>
          </div>
          {existing && (
            <span className="text-xs bg-[#E7F3EC] text-[#1F7A3F] font-semibold px-2.5 py-1 rounded-full">
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
