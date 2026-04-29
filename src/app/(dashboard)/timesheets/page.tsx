import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TimesheetEntryForm } from '@/components/time/timesheet-entry-form'
import { TimeEntryRow } from '@/components/time/time-entry-row'
import { WeeklyGrid } from '@/components/time/weekly-grid'
import { MonthlyOverview } from '@/components/time/monthly-overview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatHours } from '@/lib/utils/formatters'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  format,
  parseISO,
  isToday,
  addMonths,
  subMonths,
  setDate,
  getDate,
} from 'date-fns'

function getWeekBounds(weekParam?: string) {
  const base = weekParam ? parseISO(weekParam) : new Date()
  const start = startOfWeek(base, { weekStartsOn: 1 }) // Monday
  const end   = endOfWeek(base,   { weekStartsOn: 1 }) // Sunday
  return { start, end }
}

type ViewMode = 'daily' | 'weekly' | 'monthly'

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string; month?: string; cycleStart?: string }>
}) {
  const params = await searchParams
  const view: ViewMode =
    params.view === 'weekly' || params.view === 'monthly' ? params.view : 'daily'

  // Invoicing cycle settings
  const cycleStartDay = Math.min(28, Math.max(1, parseInt(params.cycleStart ?? '13', 10) || 13))

  // Compute current invoicing cycle based on today (or ?month=yyyy-MM-dd which should be a cycle-start date)
  function computeCycle(base: Date, startDay: number) {
    // The cycle containing `base` is: if day(base) >= startDay then [startDay of base's month .. startDay-1 of next month]
    // else [startDay of previous month .. startDay-1 of base's month]
    const baseDay = getDate(base)
    let cycleStart: Date
    if (baseDay >= startDay) {
      cycleStart = setDate(base, startDay)
    } else {
      cycleStart = setDate(subMonths(base, 1), startDay)
    }
    const cycleEnd = addMonths(cycleStart, 1)
    cycleEnd.setDate(cycleEnd.getDate() - 1)
    return { cycleStart, cycleEnd }
  }
  const cycleBase = params.month ? parseISO(params.month) : new Date()
  const { cycleStart: mCycleStart, cycleEnd: mCycleEnd } = computeCycle(cycleBase, cycleStartDay)
  const monthStart = format(mCycleStart, 'yyyy-MM-dd')
  const monthEnd   = format(mCycleEnd,   'yyyy-MM-dd')
  const prevCycleStart = format(subMonths(mCycleStart, 1), 'yyyy-MM-dd')
  const nextCycleStart = format(addMonths(mCycleStart, 1), 'yyyy-MM-dd')
  const currentCycleStart = format(computeCycle(new Date(), cycleStartDay).cycleStart, 'yyyy-MM-dd')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  // Find the logged-in user's staff profile by matching email
  const { data: myProfile } = await db
    .from('staff_profiles')
    .select('id, full_name, role')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()

  const myStaffId = myProfile?.id ?? null

  const { start, end } = getWeekBounds(params.week)
  const weekStart  = format(start, 'yyyy-MM-dd')
  const weekEnd    = format(end,   'yyyy-MM-dd')
  const prevWeek   = format(subWeeks(start, 1), 'yyyy-MM-dd')
  const nextWeek   = format(addWeeks(start, 1), 'yyyy-MM-dd')
  const weekLabel  = `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`

  const buildHref = (v: ViewMode, week?: string) => {
    const qs = new URLSearchParams()
    if (v !== 'daily') qs.set('view', v)
    if (week) qs.set('week', week)
    if (v === 'monthly') {
      if (params.month) qs.set('month', params.month)
      if (params.cycleStart) qs.set('cycleStart', params.cycleStart)
    }
    const s = qs.toString()
    return s ? `/timesheets?${s}` : '/timesheets'
  }

  const buildMonthlyHref = (opts: { month?: string; cycleStart?: number }) => {
    const qs = new URLSearchParams()
    qs.set('view', 'monthly')
    const m = opts.month ?? params.month
    const c = opts.cycleStart !== undefined ? String(opts.cycleStart) : params.cycleStart
    if (m) qs.set('month', m)
    if (c) qs.set('cycleStart', c)
    return `/timesheets?${qs.toString()}`
  }

  const prevWeekEnd = format(subWeeks(end, 1), 'yyyy-MM-dd')
  const prevWeekStart = format(subWeeks(start, 1), 'yyyy-MM-dd')

  const [
    { data: entries },
    { data: projects },
    { data: tasks },
    { data: staff },
    { data: prevEntries },
    { data: monthEntries },
    { data: roleRates },
  ] = await Promise.all([
    // Only fetch entries for the current user
    myStaffId
      ? db
          .from('time_entries')
          .select(`
            id, date, hours, description, is_billable, is_variation, rate_at_time, invoice_item_id,
            task_id, staff_id, project_id,
            staff_profiles!staff_id ( full_name ),
            project_tasks ( title ),
            projects ( job_number, title )
          `)
          .eq('staff_id', myStaffId)
          .gte('date', weekStart)
          .lte('date', weekEnd)
          .order('date', { ascending: true })
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    db
      .from('projects')
      .select('id, job_number, title, is_billable, clients ( name, company_name )')
      .in('status', ['active', 'on_hold'])
      .order('job_number', { ascending: false }),
    db
      .from('project_tasks')
      .select('id, project_id, title')
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'completed')
      .order('sort_order'),
    db
      .from('staff_profiles')
      .select('id, full_name, role, default_hourly_rate')
      .eq('is_active', true)
      .order('full_name'),
    myStaffId
      ? db
          .from('time_entries')
          .select('id, date, hours, description, is_billable, rate_at_time, invoice_item_id, task_id, staff_id, project_id')
          .eq('staff_id', myStaffId)
          .gte('date', prevWeekStart)
          .lte('date', prevWeekEnd)
      : Promise.resolve({ data: [] }),
    myStaffId && view === 'monthly'
      ? db
          .from('time_entries')
          .select('id, date, hours, is_billable, rate_at_time, invoice_item_id, project_id, task_id')
          .eq('staff_id', myStaffId)
          .gte('date', monthStart)
          .lte('date', monthEnd)
      : Promise.resolve({ data: [] }),
    db
      .from('role_rates')
      .select('role_key, label, hourly_rate')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const entryList  = (entries  ?? []) as any[]
  const projectList = (projects ?? []) as any[]
  const taskList   = (tasks    ?? []) as any[]
  const staffList  = (staff    ?? []) as any[]
  const prevEntryList = (prevEntries ?? []) as any[]
  const roleList   = (roleRates ?? []) as any[]

  // Project list flattened with client_name for grid display
  const projectsForGrid = projectList.map((p: any) => ({
    id: p.id,
    job_number: p.job_number,
    title: p.title,
    is_billable: p.is_billable,
    client_name: p.clients?.company_name ?? p.clients?.name ?? null,
  }))

  const myStaffRate = staffList.find((s: any) => s.id === myStaffId)?.default_hourly_rate ?? 0

  // Group entries by date
  const days = eachDayOfInterval({ start, end })
  const entriesByDate: Record<string, any[]> = {}
  for (const day of days) {
    entriesByDate[format(day, 'yyyy-MM-dd')] = []
  }
  for (const entry of entryList) {
    if (entriesByDate[entry.date]) {
      entriesByDate[entry.date].push(entry)
    }
  }

  // Weekly summary
  const totalHours    = entryList.reduce((sum: number, e: any) => sum + e.hours, 0)
  const billableHours = entryList.filter((e: any) => e.is_billable).reduce((sum: number, e: any) => sum + e.hours, 0)
  const nonBillableHours = totalHours - billableHours

  return (
    <div className="p-8 space-y-6">

      {/* Profile match warning */}
      {!myStaffId && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Staff profile not linked</p>
          <p className="mt-0.5">
            No staff profile was found matching your login email{' '}
            <span className="font-mono font-medium">{user.email}</span>.
            Make sure the email on your staff profile record matches exactly.
          </p>
        </div>
      )}

      {/* View tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-1">
          {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(v => (
            <Link
              key={v}
              href={buildHref(v, params.week)}
              className={
                'px-4 py-2 text-sm font-medium -mb-px border-b-2 capitalize transition-colors ' +
                (view === v
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700')
              }
            >
              {v}
            </Link>
          ))}
        </div>
      </div>

      {/* Log Time */}
      {view === 'daily' && (
        <Card>
          <CardHeader>
            <CardTitle>Log Time</CardTitle>
          </CardHeader>
          <CardContent>
            <TimesheetEntryForm
              projects={projectList}
              tasks={taskList}
              staff={staffList}
              roleRates={roleList}
              currentStaffId={myStaffId}
            />
          </CardContent>
        </Card>
      )}

      {/* Week navigation (daily + weekly only) */}
      {view !== 'monthly' && (
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Week of {weekLabel}</h2>
          <div className="flex items-center gap-2">
            <Link href={buildHref(view, prevWeek)}>
              <Button variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev
              </Button>
            </Link>
            <Link href={buildHref(view)}>
              <Button variant="outline" size="sm">This week</Button>
            </Link>
            <Link href={buildHref(view, nextWeek)}>
              <Button variant="outline" size="sm">
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Weekly summary (daily + weekly only) */}
      {view !== 'monthly' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border-2 border-slate-300 px-4 py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Hours</p>
            <p className="text-2xl font-bold text-slate-900">{formatHours(totalHours)}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Billable Hours</p>
            <p className="text-2xl font-semibold text-slate-900">{formatHours(billableHours)}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Non-Billable</p>
            <p className="text-2xl font-semibold text-slate-500">{formatHours(nonBillableHours)}</p>
          </div>
        </div>
      )}

      {/* Weekly grid view */}
      {view === 'weekly' && (
        <WeeklyGrid
          weekDays={days.map(d => format(d, 'yyyy-MM-dd'))}
          prevWeekStart={prevWeekStart}
          entries={entryList as any}
          prevEntries={prevEntryList as any}
          projects={projectsForGrid}
          tasks={taskList}
          staffId={myStaffId}
          staffRate={myStaffRate}
          staffRole={myProfile?.role ?? null}
        />
      )}

      {/* Monthly overview */}
      {view === 'monthly' && (
        <MonthlyOverview
          cycleStart={monthStart}
          cycleEnd={monthEnd}
          cycleStartDay={cycleStartDay}
          prevHref={buildMonthlyHref({ month: prevCycleStart })}
          nextHref={buildMonthlyHref({ month: nextCycleStart })}
          currentHref={buildMonthlyHref({ month: currentCycleStart })}
          currentMonth={params.month ?? monthStart}
          entries={(monthEntries ?? []) as any}
          projects={projectsForGrid}
        />
      )}

      {/* Days (daily view) */}
      {view === 'daily' && (
      entryList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <p className="text-sm text-slate-500">No time logged this week.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...days].reverse().map(day => {
            const dateKey  = format(day, 'yyyy-MM-dd')
            const dayEntries = entriesByDate[dateKey]
            if (dayEntries.length === 0) return null

            const dayTotal        = dayEntries.reduce((sum: number, e: any) => sum + e.hours, 0)
            const todayHighlight  = isToday(day)

            return (
              <Card key={dateKey} className={todayHighlight ? 'ring-1 ring-blue-200' : ''}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold text-slate-700">
                        {format(day, 'EEEE d MMMM')}
                      </CardTitle>
                      {todayHighlight && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Today</span>
                      )}
                    </div>
                    <span className="text-base font-bold text-slate-800">{formatHours(dayTotal)}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm table-fixed">
                    {/* colgroup: Project 26% | Staff 13% | Task 16% | Task Description 28% | Hours 8% | Billable 5% | Actions 4% */}
                    <colgroup>
                      <col className="w-[26%]" />
                      <col className="w-[13%]" />
                      <col className="w-[16%]" />
                      <col className="w-[28%]" />
                      <col className="w-[8%]" />
                      <col className="w-[5%]" />
                      <col className="w-[4%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Project</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Staff</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Task</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Task Description</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Hours</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Billable</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dayEntries.map((entry: any) => (
                        <TimeEntryRow
                          key={entry.id}
                          entry={entry}
                          staff={staffList}
                          tasks={taskList}
                          variant="timesheet"
                        />
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ))}
    </div>
  )
}
