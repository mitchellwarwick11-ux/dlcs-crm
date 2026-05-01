import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, Timer } from 'lucide-react'
import { TimeLogForm } from '@/components/field/time-log-form'

export default async function TimeLogPage({
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
    .select('id, date, projects ( job_number )')
    .eq('id', entryId)
    .maybeSingle()

  if (!entry) notFound()

  const [{ data: existing }, { data: roleRates }] = await Promise.all([
    db
      .from('field_time_logs')
      .select('start_time, end_time, break_minutes, total_hours, is_overtime, notes, acting_role')
      .eq('entry_id', entryId)
      .eq('staff_id', staffProfile.id)
      .maybeSingle(),
    db
      .from('role_rates')
      .select('role_key, label, hourly_rate')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const jobLabel = entry.projects?.job_number ?? entryId.slice(0, 8)

  return (
    <div className="flex flex-col flex-1 bg-[#E8E5DC]">
      {/* Header — charcoal */}
      <div className="bg-[#1A1A1E] px-4 pt-safe-top">
        <div className="flex items-center gap-2 py-3">
          <Link
            href={`/field/${entryId}`}
            className="p-1.5 -ml-1.5 rounded-lg text-[#BDBDC0] hover:bg-[#45454B] transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#F39200] font-bold tracking-[0.18em]">{jobLabel}</p>
            <h1 className="text-base font-bold text-white">Time Log</h1>
          </div>
          {existing && (
            <span className="text-xs bg-[#E6EEF7] text-[#2257A3] font-semibold px-2.5 py-1 rounded-full">
              Editing
            </span>
          )}
        </div>
      </div>

      <TimeLogForm
        entryId={entryId}
        staffId={staffProfile.id}
        staffRole={(staffProfile as any).role ?? null}
        workDate={entry.date}
        existing={existing}
        roleRates={(roleRates ?? []) as any[]}
      />
    </div>
  )
}
