'use client'

import { useMemo } from 'react'
import { addDays, format, parseISO, isWeekend } from 'date-fns'
import type { ScheduleEntryFull, FieldScheduleStatus } from '@/types/database'

interface Props {
  entries: ScheduleEntryFull[]
  /** First day to show (yyyy-MM-dd) */
  startDate: string
  /** Number of days to show (incl. weekends) */
  days: number
  /** Daily team capacity in hours (e.g. surveyors × 8). Drawn as a green target line. */
  dailyCapacityHours: number
}

const STATUS_ORDER: FieldScheduleStatus[] = ['scheduled', 'must_happen', 'asap', 'completed', 'cancelled']

const STATUS_COLOUR: Record<FieldScheduleStatus, string> = {
  scheduled:   'bg-blue-500',
  must_happen: 'bg-red-500',
  asap:        'bg-orange-400',
  completed:   'bg-emerald-500',
  cancelled:   'bg-slate-300',
}

const STATUS_LABEL: Record<FieldScheduleStatus, string> = {
  scheduled:   'Booked',
  must_happen: 'Must Happen',
  asap:        'ASAP',
  completed:   'Completed',
  cancelled:   'Cancelled',
}

const STATUS_DOT: Record<FieldScheduleStatus, string> = {
  scheduled:   'bg-blue-500',
  must_happen: 'bg-red-500',
  asap:        'bg-orange-400',
  completed:   'bg-emerald-500',
  cancelled:   'bg-slate-300',
}

interface DayCol {
  date: Date
  dateStr: string
  weekend: boolean
  total: number
  byStatus: Partial<Record<FieldScheduleStatus, number>>
}

export function PipelineBreakdownChart({ entries, startDate, days, dailyCapacityHours }: Props) {
  const capacity = Math.max(1, dailyCapacityHours)
  const overloadLine = capacity * 1.2

  const cols: DayCol[] = useMemo(() => {
    const start = parseISO(startDate)
    const out: DayCol[] = []
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i)
      const ds = format(d, 'yyyy-MM-dd')
      out.push({ date: d, dateStr: ds, weekend: isWeekend(d), total: 0, byStatus: {} })
    }
    const byDate = new Map(out.map(c => [c.dateStr, c]))
    for (const e of entries) {
      const col = byDate.get(e.date)
      if (!col) continue
      const h = e.hours ?? 0
      if (h <= 0) continue
      col.total += h
      col.byStatus[e.status] = (col.byStatus[e.status] ?? 0) + h
    }
    return out
  }, [entries, startDate, days])

  // Hide weekend columns that have nothing scheduled to keep the chart tight
  const visibleCols = cols.filter(c => !c.weekend || c.total > 0)

  const peak = Math.max(
    overloadLine * 1.05,
    ...visibleCols.map(c => c.total),
    capacity * 1.1,
  )

  // Round axis up to a tidy step (8h increments)
  const step = 8
  const yMax = Math.ceil(peak / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= yMax; v += step) ticks.push(v)

  if (visibleCols.length === 0) {
    return (
      <div className="text-sm text-slate-400 italic py-8 text-center">
        No scheduled work in this window.
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-end gap-3">
        {/* Y axis labels */}
        <div className="relative h-64 w-10 shrink-0 text-[10px] text-slate-400 tabular-nums">
          {ticks.map(t => (
            <div
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(t / yMax) * 100}%` }}
            >
              {t} hrs
            </div>
          ))}
        </div>

        {/* Plot area */}
        <div className="relative h-64 flex-1 border-l border-b border-slate-200">
          {/* Gridlines */}
          {ticks.map(t => (
            <div
              key={t}
              className="absolute left-0 right-0 border-t border-dashed border-slate-100"
              style={{ bottom: `${(t / yMax) * 100}%` }}
            />
          ))}

          {/* Capacity (green) and overload (red) reference lines */}
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-emerald-400/70"
            style={{ bottom: `${(capacity / yMax) * 100}%` }}
            title={`Daily capacity: ${capacity}h`}
          />
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-red-400/70"
            style={{ bottom: `${(overloadLine / yMax) * 100}%` }}
            title={`Overload threshold: ${overloadLine}h`}
          />

          {/* Bars */}
          <div className="absolute inset-0 flex items-end justify-around gap-1 px-1">
            {visibleCols.map(col => {
              const totalPct = (col.total / yMax) * 100
              return (
                <div key={col.dateStr} className="relative flex-1 flex flex-col items-center justify-end h-full min-w-0">
                  {col.total > 0 && (
                    <span className="text-[10px] font-semibold text-slate-700 mb-1 tabular-nums">
                      {col.total}h
                    </span>
                  )}
                  <div
                    className="relative w-full max-w-[44px] rounded-t-sm overflow-hidden flex flex-col-reverse"
                    style={{ height: `${totalPct}%` }}
                    title={`${format(col.date, 'EEE d MMM')} · ${col.total}h scheduled`}
                  >
                    {STATUS_ORDER.map(status => {
                      const h = col.byStatus[status] ?? 0
                      if (h <= 0) return null
                      const segPct = (h / col.total) * 100
                      return (
                        <div
                          key={status}
                          className={`${STATUS_COLOUR[status]} flex items-center justify-center text-[10px] font-semibold text-white`}
                          style={{ height: `${segPct}%`, minHeight: h > 0 ? '2px' : 0 }}
                          title={`${STATUS_LABEL[status]}: ${h}h`}
                        >
                          {segPct >= 14 && <span>{h}h</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* X axis labels */}
      <div className="flex items-start gap-3 mt-1">
        <div className="w-10 shrink-0" />
        <div className="flex-1 flex justify-around gap-1 px-1">
          {visibleCols.map(col => (
            <div
              key={col.dateStr}
              className={`flex-1 text-center text-[10px] leading-tight ${col.weekend ? 'text-slate-400' : 'text-slate-600'}`}
            >
              <div className="font-medium">{format(col.date, 'EEE')}</div>
              <div className="tabular-nums">{format(col.date, 'd MMM')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500 flex-wrap">
        {STATUS_ORDER.map(s => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
            {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 ml-auto">
          <span className="h-px w-4 border-t-2 border-dashed border-emerald-400" />
          Capacity ({capacity}h)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-4 border-t-2 border-dashed border-red-400" />
          Overload (+20%)
        </span>
      </div>
    </div>
  )
}
