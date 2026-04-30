import Link from 'next/link'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { formatCurrency, formatHours } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CycleStartSelector } from './cycle-start-selector'

export interface MonthlyEntry {
  id: string
  date: string
  hours: number
  is_billable: boolean
  rate_at_time: number
  project_id: string
  task_id: string | null
  invoice_item_id: string | null
}

export interface MonthlyProject {
  id: string
  job_number: string
  title: string
  client_name: string | null
}

interface Props {
  cycleStart: string      // yyyy-MM-dd
  cycleEnd: string        // yyyy-MM-dd
  cycleStartDay: number   // 1..28
  prevHref: string
  nextHref: string
  currentHref: string
  currentMonth?: string   // for the cycle selector to round-trip via URL
  entries: MonthlyEntry[]
  projects: MonthlyProject[]
}

export function MonthlyOverview({
  cycleStart, cycleEnd, cycleStartDay,
  prevHref, nextHref, currentHref, currentMonth,
  entries, projects,
}: Props) {
  const label = `${format(parseISO(cycleStart), 'd MMM yyyy')} – ${format(parseISO(cycleEnd), 'd MMM yyyy')}`

  // Totals
  const totalHours    = entries.reduce((s, e) => s + e.hours, 0)
  const billableHours = entries.filter(e => e.is_billable).reduce((s, e) => s + e.hours, 0)
  const nonBillableHours = totalHours - billableHours
  const billableAmount   = entries
    .filter(e => e.is_billable)
    .reduce((s, e) => s + e.hours * e.rate_at_time, 0)
  const invoicedHours = entries.filter(e => e.invoice_item_id).reduce((s, e) => s + e.hours, 0)
  const uninvoicedBillable = entries
    .filter(e => e.is_billable && !e.invoice_item_id)
    .reduce((s, e) => s + e.hours * e.rate_at_time, 0)

  // Breakdown by project
  interface ProjectRow {
    project: MonthlyProject
    hours: number
    billableHours: number
    billableAmount: number
    invoicedHours: number
  }
  const byProject = new Map<string, ProjectRow>()
  for (const e of entries) {
    const proj = projects.find(p => p.id === e.project_id)
    if (!proj) continue
    const row = byProject.get(proj.id) ?? {
      project: proj, hours: 0, billableHours: 0, billableAmount: 0, invoicedHours: 0,
    }
    row.hours += e.hours
    if (e.is_billable) {
      row.billableHours += e.hours
      row.billableAmount += e.hours * e.rate_at_time
    }
    if (e.invoice_item_id) row.invoicedHours += e.hours
    byProject.set(proj.id, row)
  }
  const projectRows = [...byProject.values()].sort((a, b) => b.hours - a.hours)

  // Daily histogram
  const days = eachDayOfInterval({ start: parseISO(cycleStart), end: parseISO(cycleEnd) })
  const dailyHours: Record<string, number> = {}
  for (const d of days) dailyHours[format(d, 'yyyy-MM-dd')] = 0
  for (const e of entries) {
    if (dailyHours[e.date] !== undefined) dailyHours[e.date] += e.hours
  }
  const maxDay = Math.max(1, ...Object.values(dailyHours))

  return (
    <div className="space-y-6">
      {/* Cycle nav + config */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Link href={prevHref}>
            <Button variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
          </Link>
          <Link href={currentHref}>
            <Button variant="outline" size="sm">This cycle</Button>
          </Link>
          <Link href={nextHref}>
            <Button variant="outline" size="sm">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
          <h2 className="text-base font-semibold text-slate-900 ml-3">{label}</h2>
        </div>
        <CycleStartSelector value={cycleStartDay} currentMonth={currentMonth} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Hours" value={formatHours(totalHours)} emphasis />
        <SummaryCard label="Billable Hours" value={formatHours(billableHours)} />
        <SummaryCard label="Non-Billable" value={formatHours(nonBillableHours)} muted />
        <SummaryCard label="Billable Amount" value={formatCurrency(billableAmount)} />
      </div>

      {/* Invoicing status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Invoiced So Far</p>
          <p className="text-2xl font-semibold text-slate-900">{formatHours(invoicedHours)}</p>
          <p className="text-xs text-slate-500 mt-1">of {formatHours(billableHours)} billable</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pending to Invoice</p>
          <p className="text-2xl font-semibold text-amber-700">{formatCurrency(uninvoicedBillable)}</p>
          <p className="text-xs text-slate-500 mt-1">billable hours not yet on an invoice</p>
        </div>
      </div>

      {/* Daily histogram */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-3">Daily Hours</p>
        <div className="flex items-end gap-1 h-24">
          {days.map(d => {
            const key = format(d, 'yyyy-MM-dd')
            const h = dailyHours[key] ?? 0
            const pct = (h / maxDay) * 100
            const isWeekend = d.getDay() === 0 || d.getDay() === 6
            return (
              <div key={key} className="flex-1 flex flex-col items-center justify-end" title={`${format(d, 'EEE d MMM')} — ${formatHours(h)}`}>
                <div
                  className={
                    'w-full rounded-sm ' +
                    (h === 0 ? 'bg-slate-100' : isWeekend ? 'bg-slate-300' : 'bg-blue-400')
                  }
                  style={{ height: `${Math.max(pct, h > 0 ? 4 : 2)}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-slate-400">
          <span>{format(parseISO(cycleStart), 'd MMM')}</span>
          <span>{format(parseISO(cycleEnd), 'd MMM')}</span>
        </div>
      </div>

      {/* Project breakdown */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">By Project</h3>
        </div>
        {projectRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No time logged in this cycle.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Job</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Client</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Hours</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Billable</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Invoiced</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projectRows.map(r => {
                const uninvoiced = r.billableHours - r.invoicedHours
                return (
                  <tr key={r.project.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/projects/${r.project.job_number}`}
                        className="hover:underline"
                      >
                        <span className="font-mono text-xs font-medium text-slate-700">{r.project.job_number}</span>
                        <span className="text-slate-600 ml-1.5">{r.project.title}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {r.project.client_name ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">{formatHours(r.hours)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {formatHours(r.billableHours)}
                      {uninvoiced > 0 && (
                        <span className="ml-1 text-[10px] text-amber-600">
                          ({formatHours(uninvoiced)} pending)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{formatHours(r.invoicedHours)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                      {formatCurrency(r.billableAmount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide" colSpan={2}>Total</td>
                <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatHours(totalHours)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{formatHours(billableHours)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-600">{formatHours(invoicedHours)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatCurrency(billableAmount)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, emphasis, muted }: { label: string; value: string; emphasis?: boolean; muted?: boolean }) {
  return (
    <div className={'bg-white rounded-lg px-4 py-4 ' + (emphasis ? 'border-2 border-slate-300' : 'border border-slate-200')}>
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={'text-2xl ' + (emphasis ? 'font-bold text-slate-900' : muted ? 'font-semibold text-slate-500' : 'font-semibold text-slate-900')}>
        {value}
      </p>
    </div>
  )
}
