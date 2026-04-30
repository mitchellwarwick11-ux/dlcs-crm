import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, Info } from 'lucide-react'
import { BriefAcknowledgeButton } from '@/components/field/brief-acknowledge-button'

export default async function JobBriefPage({
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
    .select('id')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()

  const { data: entry } = await db
    .from('field_schedule_entries')
    .select(`
      id, project_id, notes,
      brief_acknowledged_at, brief_acknowledged_by,
      projects ( id, job_number ),
      acknowledger:staff_profiles!brief_acknowledged_by ( full_name )
    `)
    .eq('id', entryId)
    .maybeSingle()

  if (!entry) notFound()

  const proj = entry.projects

  // Brief content lives in the schedule entry's `notes` column (set by the PM
  // in the Edit Schedule Entry form's Brief field).
  const briefContent: string | null = (entry.notes ?? '').trim() || null

  const jobLabel = proj?.job_number ?? entryId.slice(0, 8)
  const acknowledgerName: string | null = entry.acknowledger?.full_name ?? null

  return (
    <div className="flex flex-col flex-1 bg-[#F5F4F1]">
      {/* Header */}
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
            <h1 className="text-base font-bold text-white">Job Brief</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div>
          <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-2">Brief</p>
          {briefContent ? (
            <div className="bg-white border border-[#E8E6E0] rounded-xl p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-[3px] h-5 bg-[#F39200]" />
                <p className="text-[15px] font-bold text-[#111111]">From your Project Manager</p>
              </div>
              <p className="text-[13px] text-[#4B4B4F] whitespace-pre-wrap leading-relaxed">{briefContent}</p>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-white border border-[#E8E6E0] rounded-xl">
              <Info className="h-4 w-4 text-[#9A9A9C] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#4B4B4F]">No brief provided</p>
                <p className="text-xs text-[#9A9A9C] mt-0.5">
                  Your Project Manager has not added a brief for this job. If you need specific
                  instructions, contact them before heading to site.
                </p>
              </div>
            </div>
          )}

          {staffProfile && (
            <div className="mt-3">
              <BriefAcknowledgeButton
                entryId={entryId}
                staffId={staffProfile.id}
                hasBrief={!!briefContent}
                acknowledgedAt={entry.brief_acknowledged_at ?? null}
                acknowledgedByName={acknowledgerName}
              />
            </div>
          )}
        </div>

        <div className="pb-8" />
      </div>
    </div>
  )
}
