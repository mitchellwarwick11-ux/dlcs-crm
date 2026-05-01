import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, ChevronRight, MapPin, Inbox } from 'lucide-react'
import { nowInCompanyTz, addDaysIso } from '@/lib/utils/timezone'

const STATUS_LABELS: Record<string, string> = {
  must_happen: 'Must Happen',
  asap:        'ASAP',
  scheduled:   'Scheduled',
  completed:   'Completed',
  cancelled:   'Cancelled',
}
const STATUS_COLOURS: Record<string, string> = {
  must_happen: 'bg-[#F8E4E4] text-[#A31D1D]',
  asap:        'bg-[#FBF1D8] text-[#A86B0C]',
  scheduled:   'bg-[#E6EEF7] text-[#2257A3]',
  completed:   'bg-[#E7F3EC] text-[#1F7A3F]',
  cancelled:   'bg-[#EFEDE6] text-[#6B6B6F]',
}

export default async function FieldUpcomingPage() {
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

  if (!staffProfile) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
        <p className="text-[#6B6B6F] text-sm">No active staff profile found for this account.</p>
        <Link href="/field" className="mt-4 text-sm text-[#F39200] underline">Back to field app</Link>
      </div>
    )
  }

  const tzNow      = nowInCompanyTz()
  const todayIso   = tzNow.isoDate
  const tomorrowIso = addDaysIso(tzNow.midnightDate, 1)
  const tomorrow   = tomorrowIso

  // Find which entries this surveyor is on
  const { data: myLinks } = await db
    .from('field_schedule_surveyors')
    .select('entry_id')
    .eq('staff_id', staffProfile.id)

  const entryIds: string[] = (myLinks ?? []).map((l: any) => l.entry_id)

  let entries: any[] = []
  if (entryIds.length > 0) {
    const { data } = await db
      .from('field_schedule_entries')
      .select(`
        id, date, hours, time_of_day, status, notes, task_id,
        projects (
          id, job_number, site_address, suburb, job_type,
          clients ( name, company_name ),
          job_manager:staff_profiles!job_manager_id ( full_name )
        ),
        project_tasks ( id, title ),
        office_surveyor:staff_profiles!office_surveyor_id ( full_name )
      `)
      .in('id', entryIds)
      .gte('date', tomorrow)
      .neq('status', 'cancelled')
      .order('date', { ascending: true })
      .order('time_of_day', { ascending: true, nullsFirst: false })
    entries = data ?? []
  }

  // Group by date
  const groups = new Map<string, any[]>()
  for (const e of entries) {
    if (!groups.has(e.date)) groups.set(e.date, [])
    groups.get(e.date)!.push(e)
  }
  const groupedDates = Array.from(groups.keys())

  const formatDateHeading = (isoDate: string) => {
    const d = parseISO(isoDate + 'T00:00:00')
    if (isoDate === todayIso)    return `Today · ${format(d, 'EEE d MMM')}`
    if (isoDate === tomorrowIso) return `Tomorrow · ${format(d, 'EEE d MMM')}`
    return format(d, 'EEEE, d MMMM yyyy')
  }

  return (
    <div className="flex flex-col flex-1 bg-[#E8E5DC]">
      {/* Top bar */}
      <div className="bg-[#1A1A1E] text-white px-5 pt-safe-top pb-5">
        <div className="flex items-center gap-3 mt-2">
          <Link
            href="/field"
            className="w-9 h-9 rounded-full bg-[#45454B] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            aria-label="Back to today"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </Link>
          <div className="w-1 h-10 bg-[#F39200] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#9A9A9C] tracking-[0.15em]">DLCS</p>
            <p className="text-lg font-bold text-white">Upcoming Jobs</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 space-y-6 overflow-y-auto">
        <div>
          <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase">My Schedule</p>
          <p className="text-[26px] font-bold text-[#111111] mt-1.5 leading-tight">
            {entries.length} upcoming {entries.length === 1 ? 'job' : 'jobs'}
          </p>
          <p className="text-[13px] text-[#6B6B6F] mt-1">
            All jobs assigned to you from tomorrow onwards
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-[#D6D2C7]">
            <Inbox className="h-10 w-10 text-[#BDBDC0] mb-3" />
            <p className="text-[#4B4B4F] font-medium">No upcoming jobs</p>
            <p className="text-[#9A9A9C] text-sm mt-1">You have no future jobs assigned right now.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedDates.map((dateKey) => {
              const dayEntries = groups.get(dateKey)!
              return (
                <div key={dateKey}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase">
                      {formatDateHeading(dateKey)}
                    </h2>
                    <span className="text-xs text-[#6B6B6F]">
                      {dayEntries.length} {dayEntries.length === 1 ? 'job' : 'jobs'}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {dayEntries.map((entry: any) => {
                      const proj    = entry.projects
                      const task    = entry.project_tasks
                      const address = proj ? [proj.site_address, proj.suburb].filter(Boolean).join(', ') : null
                      const badgeLabel  = STATUS_LABELS[entry.status] ?? 'Scheduled'
                      const badgeColour = STATUS_COLOURS[entry.status] ?? STATUS_COLOURS.scheduled

                      return (
                        <Link
                          key={entry.id}
                          href={`/field/${entry.id}`}
                          className="block bg-white border border-[#D6D2C7] rounded-xl p-4 hover:border-[#F39200] transition-colors active:scale-[0.99]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="font-bold text-[#111111] text-[15px]">
                                  {proj?.job_number ?? 'No Job #'}
                                </span>
                                {entry.time_of_day && (
                                  <div className="flex items-center gap-1">
                                    <span className="w-[3px] h-3.5 bg-[#F39200] inline-block" />
                                    <span className="text-xs font-semibold text-[#4B4B4F] uppercase">
                                      {entry.time_of_day}{entry.hours != null ? ` · ${entry.hours}h sched` : ''}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {task && (
                                <p className="text-[15px] font-medium text-[#1F1F22]">{task.title}</p>
                              )}

                              {address && (
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-[#9A9A9C] shrink-0" />
                                  <p className="text-[13px] text-[#6B6B6F] truncate">{address}</p>
                                </div>
                              )}

                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${badgeColour}`}>
                                  {badgeLabel}
                                </span>
                                {entry.office_surveyor && (
                                  <span className="text-[11px] text-[#9A9A9C] ml-auto">
                                    Office: {entry.office_surveyor.full_name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-[18px] w-[18px] text-[#BDBDC0] shrink-0 mt-1" />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer link back to today */}
      <div className="border-t border-[#D6D2C7] px-5 py-4 pb-safe-bottom bg-white">
        <Link
          href="/field"
          className="block text-center text-xs text-[#9A9A9C] hover:text-[#4B4B4F] transition-colors"
        >
          ← Back to today
        </Link>
      </div>
    </div>
  )
}
