import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { CalendarDays, MapPin, Clock, ChevronRight, Inbox } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  must_happen: 'Must Happen',
  asap:        'ASAP',
  scheduled:   'Scheduled',
  completed:   'Completed',
  cancelled:   'Cancelled',
}
const STATUS_COLOURS: Record<string, string> = {
  must_happen: 'bg-red-100 text-red-700',
  asap:        'bg-orange-100 text-orange-700',
  scheduled:   'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-slate-100 text-slate-500',
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
        <p className="text-slate-500 text-sm">No active staff profile found for this account.</p>
        <Link href="/" className="mt-4 text-sm text-blue-600 underline">Return to office app</Link>
      </div>
    )
  }

  const today = format(new Date(), 'yyyy-MM-dd')

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

  // Also check for upcoming entries this week (next 4 days)
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
  const inFiveDays = format(new Date(Date.now() + 5 * 86400000), 'yyyy-MM-dd')
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
    <div className="flex flex-col flex-1">
      {/* Top bar */}
      <div className="bg-blue-700 text-white px-5 pt-safe-top pb-4">
        <div className="flex items-center justify-between mt-2">
          <div>
            <p className="text-xs font-medium text-blue-200 uppercase tracking-wider">DLCS Field App</p>
            <p className="text-lg font-bold mt-0.5">{staffProfile.full_name.split(' ')[0]}&apos;s Jobs</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{format(new Date(), 'EEEE')}</p>
            <p className="text-xs text-blue-200">{format(new Date(), 'd MMMM yyyy')}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">

        {/* Today's jobs */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Today</h2>
          </div>

          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No jobs scheduled for today</p>
              <p className="text-slate-400 text-sm mt-1">Check back tomorrow or contact your manager.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry: any) => {
                const proj   = entry.projects
                const task   = entry.project_tasks
                const address = proj ? [proj.site_address, proj.suburb].filter(Boolean).join(', ') : null
                const statusColour = STATUS_COLOURS[entry.status] ?? STATUS_COLOURS.scheduled
                const statusLabel  = STATUS_LABELS[entry.status]  ?? entry.status

                return (
                  <Link
                    key={entry.id}
                    href={`/field/${entry.id}`}
                    className="block bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Job number + status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 text-base">
                            {proj?.job_number ?? 'No Job #'}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColour}`}>
                            {statusLabel}
                          </span>
                          {entry.time_of_day && (
                            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase">
                              {entry.time_of_day}
                            </span>
                          )}
                        </div>

                        {/* Task */}
                        {task && (
                          <p className="text-sm font-medium text-slate-700 mt-1">{task.title}</p>
                        )}

                        {/* Address */}
                        {address && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <p className="text-sm text-slate-500 truncate">{address}</p>
                          </div>
                        )}

                        {/* Hours + office surveyor */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {entry.hours != null && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-xs text-slate-500">{entry.hours}h</span>
                            </div>
                          )}
                          {entry.office_surveyor && (
                            <span className="text-xs text-slate-500">
                              Office: {entry.office_surveyor.full_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 shrink-0 mt-1" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming this week */}
        {upcomingEntries.length > 0 && (
          <div className="mt-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Coming up</h2>
            <div className="space-y-2">
              {upcomingEntries.map((entry: any) => {
                const proj = entry.projects
                return (
                  <Link
                    key={entry.id}
                    href={`/field/${entry.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {proj?.job_number ?? '—'}
                      </span>
                      {entry.project_tasks?.title && (
                        <span className="text-xs text-slate-500 ml-2">{entry.project_tasks.title}</span>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(entry.date + 'T00:00:00'), 'EEE d MMM')}
                        {entry.time_of_day && ` · ${entry.time_of_day.toUpperCase()}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {/* Footer link to office app */}
      <div className="border-t border-slate-100 px-5 py-4 pb-safe-bottom">
        <Link
          href="/fieldwork"
          className="block text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          ← Back to office app
        </Link>
      </div>
    </div>
  )
}
