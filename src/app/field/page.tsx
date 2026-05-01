import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { MapPin, ChevronRight, Inbox, CheckCircle2, AlertCircle, Circle } from 'lucide-react'
import { SubmitDayButton } from '@/components/field/submit-day-button'
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

export default async function FieldTodayPage() {
  const supabase = await createClient()
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resolve staff profile
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
        <Link href="/" className="mt-4 text-sm text-[#F39200] underline">Return to office app</Link>
      </div>
    )
  }

  const tzNow = nowInCompanyTz()
  const today = tzNow.isoDate

  // Step 1: find which entries this surveyor is on today
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
      .eq('date', today)
      .neq('status', 'cancelled')
      .order('time_of_day', { ascending: true, nullsFirst: false })
    entries = data ?? []
  }

  // Surveyor's per-entry visit status for today's entries
  const visitByEntry: Record<string, { saved_at: string | null; submitted_at: string | null; did_not_attend: boolean }> = {}
  // Surveyor's per-entry logged hours
  const hoursByEntry: Record<string, { total: number; isOvertime: boolean }> = {}
  if (entries.length > 0) {
    const todayEntryIds = entries.map((e: any) => e.id)
    const [{ data: vs }, { data: tl }] = await Promise.all([
      db.from('field_staff_visit_status')
        .select('entry_id, saved_at, submitted_at, did_not_attend')
        .eq('staff_id', staffProfile.id)
        .in('entry_id', todayEntryIds),

      db.from('field_time_logs')
        .select('entry_id, total_hours, is_overtime')
        .eq('staff_id', staffProfile.id)
        .in('entry_id', todayEntryIds),
    ])
    for (const v of (vs ?? [])) {
      visitByEntry[v.entry_id] = {
        saved_at:       v.saved_at ?? null,
        submitted_at:   v.submitted_at ?? null,
        did_not_attend: !!v.did_not_attend,
      }
    }
    for (const t of (tl ?? [])) {
      hoursByEntry[t.entry_id] = {
        total:      Number(t.total_hours ?? 0),
        isOvertime: !!t.is_overtime,
      }
    }
  }

  // Total hours logged across today's jobs
  const totalLoggedHours = Object.values(hoursByEntry).reduce((sum, h) => sum + h.total, 0)

  // Count how many of today's jobs are in each state
  let readyCount     = 0  // saved, not yet submitted (any kind â€” attended or DNA)
  let submittedCount = 0
  for (const e of entries) {
    const v = visitByEntry[e.id]
    if (v?.submitted_at) submittedCount++
    else if (v?.saved_at) readyCount++
  }

  // Also check for upcoming entries this week (next 4 days)
  const tomorrow   = addDaysIso(tzNow.midnightDate, 1)
  const inFiveDays = addDaysIso(tzNow.midnightDate, 5)
  let upcomingEntries: any[] = []
  if (entryIds.length > 0) {
    const { data } = await db
      .from('field_schedule_entries')
      .select(`
        id, date, hours, time_of_day, status,
        projects ( job_number, site_address, suburb ),
        project_tasks ( title )
      `)
      .in('id', entryIds)
      .gte('date', tomorrow)
      .lte('date', inFiveDays)
      .neq('status', 'cancelled')
      .order('date')
    upcomingEntries = data ?? []
  }

  return (
    <div className="flex flex-col flex-1 bg-[#E8E5DC]">
      {/* Top bar â€” charcoal with orange accent rail */}
      <div className="bg-[#1A1A1E] text-white px-5 pt-safe-top pb-5">
        <div className="flex items-center gap-3 mt-2">
          <div className="w-1 h-10 bg-[#F39200] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#9A9A9C] tracking-[0.15em]">DLCS</p>
            <p className="text-lg font-bold text-white">Field App</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#45454B] flex items-center justify-center">
            <span className="text-sm font-bold text-[#F39200]">
              {staffProfile.full_name.split(' ').map((p: string) => p[0]).slice(0,2).join('')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 space-y-6 overflow-y-auto">

        {/* Greeting */}
        <div>
          <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase">Today</p>
          <p className="text-[26px] font-bold text-[#111111] mt-1.5 leading-tight">
            Good {tzNow.parts.hour < 12 ? 'morning' : tzNow.parts.hour < 17 ? 'afternoon' : 'evening'}, {staffProfile.full_name.split(' ')[0]}
          </p>
          <p className="text-[13px] text-[#6B6B6F] mt-1">
            {format(tzNow.midnightDate, 'EEEE, d MMMM yyyy')} Â· {entries.length} {entries.length === 1 ? 'job' : 'jobs'} scheduled
            {totalLoggedHours > 0 && (
              <> Â· <span className="text-[#1F7A3F] font-semibold">{totalLoggedHours.toFixed(2).replace(/\.?0+$/, '')}h logged</span></>
            )}
          </p>
        </div>

        {/* Today's jobs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase">Today&apos;s Jobs</h2>
            <span className="text-xs text-[#6B6B6F]">{format(tzNow.midnightDate, 'EEE d MMM')}</span>
          </div>

          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center bg-white rounded-xl border border-[#D6D2C7]">
              <Inbox className="h-10 w-10 text-[#BDBDC0] mb-3" />
              <p className="text-[#4B4B4F] font-medium">No jobs scheduled for today</p>
              <p className="text-[#9A9A9C] text-sm mt-1">Check back tomorrow or contact your manager.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {entries.map((entry: any) => {
                const proj   = entry.projects
                const task   = entry.project_tasks
                const address = proj ? [proj.site_address, proj.suburb].filter(Boolean).join(', ') : null
                const v = visitByEntry[entry.id]
                const h = hoursByEntry[entry.id]
                const loggedLabel = h
                  ? `${h.total.toFixed(2).replace(/\.?0+$/, '')}h logged${h.isOvertime ? ' Â· OT' : ''}`
                  : null

                // Visit-status badge â€” overrides the schedule status pill once
                // the surveyor has Saved / DNA'd / submitted.
                let badgeLabel: string
                let badgeColour: string
                let badgeIcon: React.ReactNode = null
                if (v?.submitted_at) {
                  badgeLabel  = 'Submitted'
                  badgeColour = 'bg-[#E7F3EC] text-[#1F7A3F]'
                  badgeIcon   = <CheckCircle2 className="h-3 w-3" />
                } else if (v?.saved_at && v?.did_not_attend) {
                  badgeLabel  = 'Did not attend'
                  badgeColour = 'bg-[#FBF1D8] text-[#A86B0C]'
                  badgeIcon   = <AlertCircle className="h-3 w-3" />
                } else if (v?.saved_at) {
                  badgeLabel  = 'Ready to submit'
                  badgeColour = 'bg-[#E7F3EC] text-[#1F7A3F]'
                  badgeIcon   = <CheckCircle2 className="h-3 w-3" />
                } else {
                  badgeLabel  = STATUS_LABELS[entry.status] ?? 'In progress'
                  badgeColour = STATUS_COLOURS[entry.status] ?? STATUS_COLOURS.scheduled
                  badgeIcon   = <Circle className="h-3 w-3" />
                }

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
                                {entry.time_of_day}{entry.hours != null ? ` Â· ${entry.hours}h sched` : ''}
                              </span>
                            </div>
                          )}
                          {loggedLabel && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${h?.isOvertime ? 'bg-[#FBF1D8] text-[#A86B0C]' : 'bg-[#E7F3EC] text-[#1F7A3F]'}`}>
                              {loggedLabel}
                            </span>
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
                          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${badgeColour}`}>
                            {badgeIcon}
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
          )}

          {/* End-of-day submission */}
          {entries.length > 0 && (
            <div className="mt-5">
              <SubmitDayButton
                date={today}
                totalToday={entries.length}
                readyToSubmit={readyCount}
                alreadyDone={submittedCount}
              />
            </div>
          )}
        </div>

        {/* Upcoming this week */}
        {upcomingEntries.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase">Coming up</h2>
              <Link
                href="/field/upcoming"
                className="text-[11px] font-semibold text-[#F39200] hover:underline"
              >
                View all â†’
              </Link>
            </div>
            <div className="space-y-1.5">
              {upcomingEntries.map((entry: any) => {
                const proj = entry.projects
                return (
                  <Link
                    key={entry.id}
                    href={`/field/${entry.id}`}
                    className="flex items-center gap-3 px-3.5 py-3 bg-white rounded-lg border border-[#EFEDE6] hover:border-[#F39200] transition-colors"
                  >
                    <span className="font-bold text-[13px] text-[#111111] shrink-0">
                      {proj?.job_number ?? 'â€”'}
                    </span>
                    <div className="flex-1 min-w-0">
                      {entry.project_tasks?.title && (
                        <p className="text-[13px] text-[#4B4B4F] truncate">{entry.project_tasks.title}</p>
                      )}
                      <p className="text-[11px] text-[#9A9A9C] mt-0.5">
                        {format(new Date(entry.date + 'T00:00:00'), 'EEE d MMM')}
                        {entry.time_of_day && ` Â· ${entry.time_of_day.toUpperCase()}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#BDBDC0] shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Always-available link to full upcoming schedule */}
        {upcomingEntries.length === 0 && (
          <Link
            href="/field/upcoming"
            className="flex items-center justify-between gap-3 px-4 py-3 bg-white rounded-xl border border-[#D6D2C7] hover:border-[#F39200] transition-colors"
          >
            <div>
              <p className="text-[13px] font-semibold text-[#1F1F22]">View upcoming jobs</p>
              <p className="text-[11px] text-[#9A9A9C] mt-0.5">See all your future assignments</p>
            </div>
            <ChevronRight className="h-4 w-4 text-[#BDBDC0] shrink-0" />
          </Link>
        )}

      </div>

      {/* Footer link to office app */}
      <div className="border-t border-[#D6D2C7] px-5 py-4 pb-safe-bottom bg-white">
        <Link
          href="/fieldwork"
          className="block text-center text-xs text-[#9A9A9C] hover:text-[#4B4B4F] transition-colors"
        >
          â† Back to office app
        </Link>
      </div>
    </div>
  )
}
