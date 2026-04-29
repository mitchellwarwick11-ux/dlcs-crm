'use client'

import { useMemo, useState } from 'react'
import {
  startOfWeek, addDays, addWeeks, subWeeks, format, parseISO, isToday, isSameDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react'
import type { ScheduleEntryFull } from '@/types/database'

interface Props {
  selectedDate: string
  onSelectDate: (date: string) => void
  entries: ScheduleEntryFull[]
  weeksToShow?: number
  disabled?: boolean
  /** Total field-work hours that can be scheduled in a day (e.g. surveyor count × 8). Defaults to 8. */
  dailyCapacityHours?: number
}

export function ScheduleAvailabilityCalendar({
  selectedDate,
  onSelectDate,
  entries,
  weeksToShow = 4,
  disabled = false,
  dailyCapacityHours = 8,
}: Props) {
  const capacity = Math.max(1, dailyCapacityHours)
  const today = new Date()
  const baseStart = startOfWeek(today, { weekStartsOn: 1 })
  const [offset, setOffset] = useState(0)
  const [extraWeeks, setExtraWeeks] = useState(0)
  const weekStart = addWeeks(baseStart, offset)
  const totalWeeks = weeksToShow + extraWeeks

  // Group entries by date string (yyyy-MM-dd)
  const byDate = useMemo(() => {
    const m = new Map<string, ScheduleEntryFull[]>()
    for (const e of entries) {
      const arr = m.get(e.date) ?? []
      arr.push(e)
      m.set(e.date, arr)
    }
    return m
  }, [entries])

  const weeks: Date[][] = []
  for (let w = 0; w < totalWeeks; w++) {
    const start = addWeeks(weekStart, w)
    weeks.push([0, 1, 2, 3, 4].map(d => addDays(start, d))) // Mon-Fri
  }

  const rangeStart = format(weeks[0][0], 'd MMM')
  const rangeEnd = format(weeks[weeks.length - 1][4], 'd MMM yyyy')

  function loadFor(date: Date) {
    const key = format(date, 'yyyy-MM-dd')
    const dayEntries = byDate.get(key) ?? []
    const totalHours = dayEntries.reduce((s, e) => s + (e.hours ?? 0), 0)
    return { key, dayEntries, totalHours }
  }

  return (
    <div className={disabled ? 'opacity-60 pointer-events-none' : ''}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Availability · {rangeStart} – {rangeEnd}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset(o => o - 1)}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            aria-label="Previous weeks"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="px-1.5 text-[11px] text-slate-500 hover:text-slate-700"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setOffset(o => o + 1)}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            aria-label="Next weeks"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => (
          <div key={d} className="text-[10px] font-medium text-slate-400 uppercase tracking-wider text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-5 gap-1">
            {week.map(day => {
              const { key, totalHours, dayEntries } = loadFor(day)
              const selected = key === selectedDate
              const isTodayCell = isToday(day)

              // Load buckets relative to total daily capacity (surveyors × 8h)
              const ratio = totalHours / capacity
              let load: 'empty' | 'light' | 'busy' | 'full' = 'empty'
              if (ratio > 0 && ratio < 0.5) load = 'light'
              else if (ratio >= 0.5 && ratio < 1) load = 'busy'
              else if (ratio >= 1) load = 'full'

              const loadText = {
                empty: 'text-slate-400',
                light: 'text-emerald-700',
                busy:  'text-amber-700',
                full:  'text-red-700',
              }[load]

              const loadFill = {
                empty: '',
                light: 'bg-emerald-200/70',
                busy:  'bg-amber-200/70',
                full:  'bg-red-300/70',
              }[load]

              const fillPct = Math.min(100, Math.round((totalHours / capacity) * 100))

              const hasMustHappen = dayEntries.some(e => e.status === 'must_happen')

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectDate(key)}
                  className={[
                    'relative overflow-hidden rounded-md border text-left p-1.5 min-h-[64px] transition-colors',
                    selected
                      ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white',
                    isTodayCell && !selected ? 'border-slate-400' : '',
                  ].join(' ')}
                  title={
                    totalHours > 0
                      ? `${totalHours}h scheduled · ${Math.max(0, capacity - totalHours)}h free of ${capacity}h capacity${dayEntries.length ? ` · ${dayEntries.length} entr${dayEntries.length === 1 ? 'y' : 'ies'}` : ''}`
                      : `No work scheduled · ${capacity}h free`
                  }
                >
                  {fillPct > 0 && !selected && (
                    <span
                      aria-hidden
                      className={`absolute inset-x-0 bottom-0 ${loadFill} transition-all duration-300`}
                      style={{ height: `${fillPct}%` }}
                    />
                  )}

                  <div className="relative flex items-start justify-between gap-1 min-h-full">
                    <span className={`text-xs font-semibold ${selected ? 'text-blue-700' : isTodayCell ? 'text-slate-900' : 'text-slate-500'}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-col items-end leading-tight">
                      <span className={`text-sm font-bold tabular-nums ${selected ? 'text-blue-700' : loadText}`}>
                        {totalHours > 0 ? `${totalHours}h` : '—'}
                      </span>
                      <span className={`text-[10px] font-medium tabular-nums ${selected ? 'text-blue-600/80' : 'text-slate-500'}`}>
                        {Math.max(0, capacity - totalHours)}h free
                      </span>
                    </div>
                  </div>

                  {hasMustHappen && (
                    <span
                      className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-red-500"
                      title="Has 'Must Happen' entries"
                    />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => setExtraWeeks(n => n + 1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-blue-300 bg-blue-50 text-xs font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another week
        </button>
        {extraWeeks > 0 && (
          <button
            type="button"
            onClick={() => setExtraWeeks(n => Math.max(0, n - 1))}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Remove last week"
          >
            <Minus className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-100 border border-emerald-200" />Light</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-100 border border-amber-200" />Busy</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-100 border border-red-200" />Full</span>
        <span className="ml-auto">Click a day to select</span>
      </div>
    </div>
  )
}
