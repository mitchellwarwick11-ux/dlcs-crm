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
    .select('id, full_name')
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

  const { data: existing } = await db
    .from('field_time_logs')
    .select('start_time, end_time, break_minutes, total_hours, is_overtime, notes')
    .eq('entry_id', entryId)
    .eq('staff_id', staffProfile.id)
    .maybeSingle()

  const jobLabel = entry.projects?.job_number ?? entryId.slice(0, 8)

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
          <div className="flex items-center gap-2 flex-1">
            <Timer className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-slate-500 font-medium">{jobLabel}</p>
              <h1 className="text-base font-bold text-slate-900">Time Log</h1>
            </div>
          </div>
          {existing && (
            <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-1 rounded-full">
              Editing
            </span>
          )}
        </div>
      </div>

      <TimeLogForm
        entryId={entryId}
        staffId={staffProfile.id}
        workDate={entry.date}
        existing={existing}
      />
    </div>
  )
}
