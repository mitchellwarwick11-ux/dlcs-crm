import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TimesheetEntryForm } from '@/components/time/timesheet-entry-form'
import { TimeEntryRow } from '@/components/time/time-entry-row'
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
} from 'date-fns'

function getWeekBounds(weekParam?: string) {
  const base = weekParam ? parseISO(weekParam) : new Date()
  const start = startOfWeek(base, { weekStartsOn: 1 }) // Monday
  const end   = endOfWeek(base,   { weekStartsOn: 1 }) // Sunday
  return { start, end }
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  // Find the logged-in user's staff profile by matching email
  const { data: myProfile } = await db
    .from('staff_profiles')
    .select('id, full_name')
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

  const [
    { data: entries },
    { data: projects },
    { data: tasks },
    { data: staff },
  ] = await Promise.all([
    // Only fetch entries for the current user
    myStaffId
      ? db
          .from('time_entries')
          .select(`
            id, date, hours, description, is_billable, rate_at_time, invoice_item_id,
            task_id, staff_id, project_id,
            staff_profiles ( full_name ),
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
      .select('id, job_number, title, is_billable')
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
      .select('id, full_name, default_hourly_rate')
      .eq('is_active', true)
      .order('full_name'),
  ])

  const entryList  = (entries  ?? []) as any[]
  const projectList = (projects ?? []) as any[]
  const taskList   = (tasks    ?? []) as any[]
  const staffList  = (staff    ?? []) as any[]

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

      {/* Log Time */}
      <Card>
        <CardHeader>
          <CardTitle>Log Time</CardTitle>
        </CardHeader>
        <CardContent>
          <TimesheetEntryForm
            projects={projectList}
            tasks={taskList}
            staff={staffList}
            currentStaffId={myStaffId}
          />
        </CardContent>
      </Card>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Week of {weekLabel}</h2>
        <div className="flex items-center gap-2">
          <Link href={`/timesheets?week=${prevWeek}`}>
            <Button variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
          </Link>
          <Link href="/timesheets">
            <Button variant="outline" size="sm">This week</Button>
          </Link>
          <Link href={`/timesheets?week=${nextWeek}`}>
            <Button variant="outline" size="sm">
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Weekly summary */}
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

      {/* Days */}
      {entryList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <p className="text-sm text-slate-500">No time logged this week.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {days.map(day => {
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
      )}
    </div>
  )
}
