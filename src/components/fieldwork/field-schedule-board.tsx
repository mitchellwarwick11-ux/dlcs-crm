'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  startOfWeek, addDays, addWeeks, subWeeks,
  eachDayOfInterval, isWeekend, format, parseISO, isToday,
} from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Plus, Info, Map as MapIcon, CalendarPlus, X, BarChart3, Search } from 'lucide-react'

// Leaflet relies on window/document — load the map component client-side only.
const FieldScheduleMap = dynamic(() => import('./field-schedule-map'), {
  ssr: false,
  loading: () => <div className="h-[480px] rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">Loading map…</div>,
})
import { Button } from '@/components/ui/button'
import { StaffAvatar, StaffAvatarStack } from '@/components/ui/staff-avatar'
import { createClient } from '@/lib/supabase/client'
import { ScheduleEntryModal } from './schedule-entry-modal'
import { PipelineBreakdownChart } from './pipeline-breakdown-chart'
import type { ScheduleEntryFull, FieldScheduleStatus } from '@/types/database'

interface StaffOption { id: string; full_name: string; role?: string }
interface EquipmentOption { id: string; label: string }
interface TaskOption { id: string; project_id: string; title: string }
interface ProjectOption {
  id: string
  job_number: string
  title: string
  site_address: string | null
  suburb: string | null
  clients: { name: string; company_name: string | null } | null
  job_manager: { full_name: string } | null
}

interface Props {
  initialEntries: ScheduleEntryFull[]
  weekStart: string
  canEdit: boolean
  projects: ProjectOption[]
  fieldSurveyors: StaffOption[]
  officeSurveyors: StaffOption[]
  allTasks: TaskOption[]
  equipment: EquipmentOption[]
  allStaff: StaffOption[]
}

const STATUS_CONFIG: Record<FieldScheduleStatus, { label: string; className: string }> = {
  must_happen: { label: 'Must Happen', className: 'bg-red-100 text-red-800 border border-red-200'     },
  asap:        { label: 'ASAP',        className: 'bg-orange-100 text-orange-800 border border-orange-200' },
  scheduled:   { label: 'Scheduled',   className: 'bg-blue-100 text-blue-800 border border-blue-200'  },
  completed:   { label: 'Completed',   className: 'bg-green-100 text-green-800 border border-green-200'},
  cancelled:   { label: 'Cancelled',   className: 'bg-slate-100 text-slate-500 border border-slate-200'},
}

const STATUS_ORDER: Record<FieldScheduleStatus, number> = {
  must_happen: 0,
  asap:        1,
  scheduled:   2,
  completed:   3,
  cancelled:   4,
}

type SortCol = 'job_number' | 'address' | 'task' | 'surveyors' | 'resources' | 'hours' | 'office_surveyor' | 'job_manager' | 'status' | 'client' | 'notes'
type SortDir = 'asc' | 'desc'

function StatusBadge({ status }: { status: FieldScheduleStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

const DAILY_TARGET = 8

function SurveyorSummary({
  entries,
  fieldSurveyors,
}: {
  entries: ScheduleEntryFull[]
  fieldSurveyors: StaffOption[]
}) {
  // Seed the map with every active field surveyor at 0h so anyone without
  // allocations still appears in the summary (makes gaps obvious).
  const map = new Map<string, { name: string; hours: number }>()
  for (const fs of fieldSurveyors) {
    map.set(fs.id, { name: fs.full_name, hours: 0 })
  }
  for (const entry of entries) {
    const hrs = Number(entry.hours ?? 0)
    for (const s of entry.field_surveyors) {
      const cur = map.get(s.id) ?? { name: s.full_name, hours: 0 }
      map.set(s.id, { name: cur.name, hours: cur.hours + hrs })
    }
  }
  if (map.size === 0) return null

  const surveyors = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  const totalAllocated = surveyors.reduce((sum, s) => sum + s.hours, 0)
  const totalShort     = Math.max(0, surveyors.length * DAILY_TARGET - totalAllocated)

  return (
    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Surveyor Hours</span>
        <span className="text-xs text-slate-500">
          {totalAllocated}h allocated of {surveyors.length * DAILY_TARGET}h target
          {totalShort > 0 && (
            <span className="ml-1.5 font-medium text-amber-600">· {totalShort}h unallocated</span>
          )}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {surveyors.map(s => {
          const diff = s.hours - DAILY_TARGET
          const label = s.name.split(' ').map((p, i) => i === 0 ? p : p[0] + '.').join(' ')
          const dot =
            diff === 0
              ? 'bg-emerald-500'
              : diff < 0
              ? 'bg-amber-500'
              : 'bg-rose-500'
          return (
            <span
              key={s.name}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200"
            >
              <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
              {label} · {s.hours}h
              {diff < 0 && <span className="text-stone-500">({-diff}h short)</span>}
              {diff > 0 && <span className="text-stone-500">(+{diff}h over)</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Inline surveyor select (avatar stack + multi-select popover) ───────────
function SurveyorSelect({
  entry,
  allStaff,
  onSave,
  disabled,
}: {
  entry: ScheduleEntryFull
  allStaff: StaffOption[]
  onSave: (entryId: string, ids: string[]) => Promise<void>
  disabled?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const fieldGroup = allStaff.filter(s => s.role === 'field_surveyor')
  const otherGroup = allStaff.filter(s => s.role !== 'field_surveyor')
  const selectedIds = new Set(entry.field_surveyors.map(s => s.id))
  const names = entry.field_surveyors.map(s => s.full_name)

  // Position popover below trigger, keep inside viewport
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = 224 // w-56
    const maxLeft = window.innerWidth - width - 8
    setPos({
      top: rect.bottom + 4,
      left: Math.min(rect.left, Math.max(8, maxLeft)),
    })
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function toggleStaff(staffId: string) {
    const next = new Set(selectedIds)
    if (next.has(staffId)) next.delete(staffId)
    else next.add(staffId)
    setSaving(true)
    await onSave(entry.id, Array.from(next))
    setSaving(false)
  }

  if (saving) return <span className="text-xs text-slate-400">Saving…</span>

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-100 transition-colors disabled:opacity-60 disabled:pointer-events-none"
        title={names.length > 0 ? names.join(', ') : 'Unassigned — click to assign'}
      >
        <StaffAvatarStack names={names} size="sm" limit={3} />
      </button>

      {open && pos && typeof window !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 224 }}
          className="z-50 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto"
        >
          {fieldGroup.length > 0 && (
            <>
              <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                Field Surveyors
              </div>
              {fieldGroup.map(s => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleStaff(s.id)}
                    className="rounded border-slate-300 h-3.5 w-3.5"
                  />
                  <StaffAvatar name={s.full_name} size="xs" />
                  <span className="text-slate-700">{s.full_name}</span>
                </label>
              ))}
            </>
          )}
          {otherGroup.length > 0 && (
            <>
              <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-t border-slate-100">
                Other Staff
              </div>
              {otherGroup.map(s => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleStaff(s.id)}
                    className="rounded border-slate-300 h-3.5 w-3.5"
                  />
                  <StaffAvatar name={s.full_name} size="xs" />
                  <span className="text-slate-700">{s.full_name}</span>
                </label>
              ))}
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

// ─── Inline Hours + AM/PM editor ────────────────────────────────────────
function HoursCell({
  entry,
  onSave,
  disabled,
}: {
  entry: ScheduleEntryFull
  onSave: (entryId: string, hours: number | null, timeOfDay: 'am' | 'pm' | null) => Promise<void>
  disabled?: boolean
}) {
  const [value, setValue] = useState(entry.hours != null ? String(entry.hours) : '')
  const [saving, setSaving] = useState(false)

  // Sync local state if the entry changes externally (e.g. router.refresh)
  useEffect(() => {
    setValue(entry.hours != null ? String(entry.hours) : '')
  }, [entry.hours])

  async function saveHours() {
    const next = value === '' ? null : parseFloat(value)
    const prev = entry.hours ?? null
    // Skip no-op
    if (next === prev) return
    if (next !== null && (isNaN(next) || next < 0)) {
      setValue(entry.hours != null ? String(entry.hours) : '')
      return
    }
    setSaving(true)
    await onSave(entry.id, next, entry.time_of_day ?? null)
    setSaving(false)
  }

  async function saveTimeOfDay(tod: 'am' | 'pm' | null) {
    if ((entry.time_of_day ?? null) === tod) return
    setSaving(true)
    await onSave(entry.id, entry.hours ?? null, tod)
    setSaving(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setValue(entry.hours != null ? String(entry.hours) : '')
      e.currentTarget.blur()
    }
  }

  if (saving) return <span className="text-xs text-slate-400">Saving…</span>

  const btnBase   = 'px-1.5 py-0.5 text-[10px] font-semibold transition-colors'
  const btnActive = 'bg-blue-600 text-white'
  const btnIdle   = 'bg-white text-slate-500 hover:bg-slate-100'

  return (
    <div className={`inline-flex items-center gap-1.5 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <input
        type="number"
        min="0"
        step="0.5"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={saveHours}
        onKeyDown={handleKeyDown}
        placeholder="—"
        className="w-12 text-sm tabular-nums text-right text-slate-700 border border-slate-200 bg-white rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-300"
      />
      <div className="inline-flex rounded border border-slate-200 overflow-hidden">
        <button
          type="button"
          onClick={() => saveTimeOfDay('am')}
          className={`${btnBase} ${entry.time_of_day === 'am' ? btnActive : btnIdle}`}
          title="Morning"
        >AM</button>
        <button
          type="button"
          onClick={() => saveTimeOfDay('pm')}
          className={`${btnBase} border-l border-slate-200 ${entry.time_of_day === 'pm' ? btnActive : btnIdle}`}
          title="Afternoon"
        >PM</button>
        <button
          type="button"
          onClick={() => saveTimeOfDay(null)}
          className={`${btnBase} border-l border-slate-200 ${entry.time_of_day == null ? 'bg-slate-200 text-slate-700' : btnIdle}`}
          title="Any time"
        >—</button>
      </div>
    </div>
  )
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol | null; sortDir: SortDir }) {
  if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 text-slate-300" />
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 ml-1 text-slate-600" />
    : <ChevronDown className="h-3 w-3 ml-1 text-slate-600" />
}

function getSortValue(entry: ScheduleEntryFull, col: SortCol): string | number {
  const proj = entry.projects
  switch (col) {
    case 'job_number':      return proj?.job_number ?? ''
    case 'address':         return proj ? [proj.site_address, proj.suburb].filter(Boolean).join(', ') : ''
    case 'task':            return entry.project_tasks?.title ?? ''
    case 'surveyors':       return entry.field_surveyors.map(s => s.full_name).join(', ')
    case 'resources':       return entry.resources.map(r => r.label).join(', ')
    case 'hours':           return entry.hours ?? -1
    case 'office_surveyor': return entry.office_surveyor?.full_name ?? ''
    case 'job_manager':     return proj?.job_manager?.full_name ?? ''
    case 'status':          return STATUS_ORDER[entry.status] ?? 99
    case 'client':          return proj?.clients ? (proj.clients.company_name ?? proj.clients.name) : ''
    case 'notes':           return entry.notes ?? ''
  }
}

function sortEntries(entries: ScheduleEntryFull[], col: SortCol, dir: SortDir): ScheduleEntryFull[] {
  return [...entries].sort((a, b) => {
    const av = getSortValue(a, col)
    const bv = getSortValue(b, col)
    let cmp = 0
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv
    } else {
      cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true })
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

export function FieldScheduleBoard({
  initialEntries,
  weekStart: weekStartStr,
  canEdit,
  projects,
  fieldSurveyors,
  officeSurveyors,
  allTasks,
  equipment,
  allStaff,
}: Props) {
  const router   = useRouter()
  const supabase = createClient()

  async function updateSurveyors(entryId: string, surveyorIds: string[]) {
    const db = supabase as any
    await db.from('field_schedule_surveyors').delete().eq('entry_id', entryId)
    if (surveyorIds.length > 0) {
      await db.from('field_schedule_surveyors').insert(
        surveyorIds.map(id => ({ entry_id: entryId, staff_id: id }))
      )
    }
    router.refresh()
  }

  async function updateHoursAndTime(
    entryId: string,
    hours: number | null,
    timeOfDay: 'am' | 'pm' | null,
  ) {
    const db = supabase as any
    await db.from('field_schedule_entries')
      .update({ hours, time_of_day: timeOfDay })
      .eq('id', entryId)
    router.refresh()
  }

  const [modalOpen, setModalOpen]       = useState(false)
  const [editingEntry, setEditingEntry] = useState<ScheduleEntryFull | null>(null)
  const [prefillDate, setPrefillDate]   = useState('')
  const [sortCol, setSortCol]           = useState<SortCol | null>(null)
  const [sortDir, setSortDir]           = useState<SortDir>('asc')
  const [showMap, setShowMap]           = useState(false)
  const [showChart, setShowChart]       = useState(false)
  const [searchTerm, setSearchTerm]     = useState('')
  const [extraDays, setExtraDays]       = useState<Set<string>>(new Set())
  const [addDayMenuOpen, setAddDayMenuOpen] = useState(false)
  const [extraWeeks, setExtraWeeks]     = useState(0)

  const weekStart = parseISO(weekStartStr)
  const weekEnd   = addDays(weekStart, 13 + extraWeeks * 7) // 2 weeks + any added weeks

  // Apply search filter (job number or suburb, case-insensitive)
  const q = searchTerm.trim().toLowerCase()
  const filteredEntries = q
    ? initialEntries.filter(e => {
        const job = e.projects?.job_number?.toLowerCase() ?? ''
        const suburb = e.projects?.suburb?.toLowerCase() ?? ''
        return job.includes(q) || suburb.includes(q)
      })
    : initialEntries

  // Group entries by date string
  const entriesByDate: Record<string, ScheduleEntryFull[]> = {}
  for (const entry of filteredEntries) {
    if (!entriesByDate[entry.date]) entriesByDate[entry.date] = []
    entriesByDate[entry.date].push(entry)
  }

  // Weekday backbone (Mon–Fri × 2 weeks). Weekend days are opt-in.
  const weekdayDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
    .filter(d => !isWeekend(d))

  // Weekend days are shown if they already have entries OR were manually added.
  const weekendDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
    .filter(d => isWeekend(d))
  const visibleWeekendDays = weekendDays.filter(d => {
    const ds = format(d, 'yyyy-MM-dd')
    return extraDays.has(ds) || (entriesByDate[ds]?.length ?? 0) > 0
  })

  const days = [...weekdayDays, ...visibleWeekendDays].sort(
    (a, b) => a.getTime() - b.getTime()
  )

  const hideableWeekendDates = new Set(
    weekendDays
      .map(d => format(d, 'yyyy-MM-dd'))
      .filter(ds => extraDays.has(ds) && (entriesByDate[ds]?.length ?? 0) === 0)
  )

  const addableWeekendDays = weekendDays.filter(d => {
    const ds = format(d, 'yyyy-MM-dd')
    return !extraDays.has(ds) && (entriesByDate[ds]?.length ?? 0) === 0
  })

  function hideWeekendDay(dateStr: string) {
    setExtraDays(prev => {
      const next = new Set(prev)
      next.delete(dateStr)
      return next
    })
  }

  function showWeekendDay(dateStr: string) {
    setExtraDays(prev => {
      const next = new Set(prev)
      next.add(dateStr)
      return next
    })
    setAddDayMenuOpen(false)
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function navigateWeek(direction: 'prev' | 'next' | 'today') {
    let target: Date
    if (direction === 'today') {
      target = startOfWeek(new Date(), { weekStartsOn: 1 })
    } else if (direction === 'next') {
      target = addWeeks(weekStart, 1)
    } else {
      target = subWeeks(weekStart, 1)
    }
    setExtraWeeks(0)
    router.push(`/fieldwork?week=${format(target, 'yyyy-MM-dd')}`)
  }

  function openAdd(dateStr: string) {
    setPrefillDate(dateStr)
    setEditingEntry(null)
    setModalOpen(true)
  }

  function openEdit(entry: ScheduleEntryFull) {
    setEditingEntry(entry)
    setPrefillDate(entry.date)
    setModalOpen(true)
  }

  const week1Label = `${format(weekdayDays[0], 'd MMM')} – ${format(weekdayDays[4], 'd MMM yyyy')}`
  const week2Label = `${format(weekdayDays[5], 'd MMM')} – ${format(weekdayDays[9], 'd MMM yyyy')}`

  function ThSort({ col, children, className = '', center = false }: { col: SortCol; children: React.ReactNode; className?: string; center?: boolean }) {
    return (
      <th
        className={`${center ? 'text-center' : 'text-left'} px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 hover:bg-slate-100 transition-colors ${className}`}
        onClick={() => handleSort(col)}
      >
        <span className="inline-flex items-center">
          {children}
          <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
        </span>
      </th>
    )
  }

  return (
    <div className="p-8 space-y-6">

      {/* Page header + navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Field Schedule</h1>
          <p className="text-sm text-slate-500 mt-0.5">{week1Label} &nbsp;·&nbsp; {week2Label}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search job # or suburb…"
              className="h-9 pl-8 pr-7 w-56 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {canEdit && addableWeekendDays.length > 0 && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddDayMenuOpen(o => !o)}
                title="Reveal a weekend day for occasional weekend work"
              >
                <CalendarPlus className="h-4 w-4 mr-1" />
                Add a Day
              </Button>
              {addDayMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setAddDayMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Weekend Days
                    </div>
                    {addableWeekendDays.map(d => {
                      const ds = format(d, 'yyyy-MM-dd')
                      return (
                        <button
                          key={ds}
                          type="button"
                          onClick={() => showWeekendDay(ds)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm text-slate-700"
                        >
                          {format(d, 'EEEE d MMM')}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExtraWeeks(n => n + 1)}
            title="Show another week of days at the bottom of the schedule"
          >
            <CalendarPlus className="h-4 w-4 mr-1" />
            Add Week
          </Button>
          <Button
            variant={showChart ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowChart(s => !s)}
            title="Toggle pipeline breakdown chart"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Chart
          </Button>
          <Button
            variant={showMap ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowMap(s => !s)}
            title="Toggle map view of scheduled sites"
          >
            <MapIcon className="h-4 w-4 mr-1" />
            Map
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeek('today')}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showMap && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <FieldScheduleMap entries={filteredEntries} />
        </div>
      )}

      {showChart && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Pipeline – Breakdown</h3>
            <span className="text-xs text-slate-400">Hours per day, by status</span>
          </div>
          <PipelineBreakdownChart
            entries={filteredEntries}
            startDate={weekStartStr}
            days={14 + extraWeeks * 7}
            dailyCapacityHours={Math.max(1, fieldSurveyors.length) * 8}
          />
        </div>
      )}

      {/* Day sections */}
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const rawEntries = entriesByDate[dateStr] ?? []
        const dayEntries = sortCol ? sortEntries(rawEntries, sortCol, sortDir) : rawEntries
        const today = isToday(day)

        return (
          <div key={dateStr} className="bg-white rounded-lg border border-slate-200 overflow-hidden">

            {/* Day header */}
            <div className={`flex items-center justify-between px-5 py-3 border-b border-slate-100 ${today ? 'bg-dlcs-sidebar-bg border-l-4 border-l-dlcs-brand pl-4' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${today ? 'text-white' : 'text-slate-700'}`}>
                  {format(day, 'EEEE d MMMM yyyy')}
                </span>
                {today && (
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] bg-dlcs-brand text-white px-2 py-0.5 rounded-full">Today</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {canEdit && (
                  <button
                    onClick={() => openAdd(dateStr)}
                    className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${
                      today
                        ? 'text-dlcs-nav-text hover:text-white hover:bg-dlcs-sidebar-active'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Entry
                  </button>
                )}
                {hideableWeekendDates.has(dateStr) && (
                  <button
                    onClick={() => hideWeekendDay(dateStr)}
                    className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
                    title="Hide this weekend day"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Entries table */}
            {dayEntries.length === 0 ? (
              <div className="px-5 py-4 text-sm text-slate-400 italic">No entries scheduled.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <ThSort col="job_number" className="whitespace-nowrap">Job #</ThSort>
                      <th className="px-1 py-2 w-6" />
                      <ThSort col="task">Task</ThSort>
                      <ThSort col="resources">Resources</ThSort>
                      <ThSort col="hours" center className="whitespace-nowrap">Hours</ThSort>
                      <ThSort col="surveyors" center>Field</ThSort>
                      <ThSort col="address">Address</ThSort>
                      <ThSort col="job_manager" center className="whitespace-nowrap">Manager</ThSort>
                      <ThSort col="office_surveyor" center className="whitespace-nowrap">Office</ThSort>
                      <ThSort col="status">Status</ThSort>
                      <ThSort col="client">Client</ThSort>
                      <ThSort col="notes">Notes</ThSort>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {dayEntries.map(entry => {
                      const proj = entry.projects
                      const address = proj
                        ? [proj.site_address, proj.suburb].filter(Boolean).join(', ') || '—'
                        : '—'
                      const client = proj?.clients
                        ? (proj.clients.company_name ?? proj.clients.name)
                        : '—'
                      const resourceNames = entry.resources.map(r => r.label).join(', ') || '—'

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-medium text-slate-900 whitespace-nowrap">
                            {proj?.job_number ?? '—'}
                          </td>
                          <td className="px-1 py-2.5">
                            <button
                              onClick={() => openEdit(entry)}
                              className="p-0.5 text-slate-300 hover:text-blue-500 transition-colors"
                              title={canEdit ? 'Edit entry' : 'View entry'}
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-slate-700 text-xs whitespace-nowrap">
                            {entry.project_tasks?.title ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs">{resourceNames}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-center">
                            <div className="inline-flex justify-center">
                              <HoursCell entry={entry} onSave={updateHoursAndTime} disabled={!canEdit} />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="inline-flex justify-center">
                              <SurveyorSelect entry={entry} allStaff={allStaff} onSave={updateSurveyors} disabled={!canEdit} />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs max-w-[180px] truncate">{address}</td>
                          <td className="px-4 py-2.5 text-center">
                            {proj?.job_manager?.full_name
                              ? <div className="inline-flex justify-center"><StaffAvatar name={proj.job_manager.full_name} size="sm" /></div>
                              : <span className="text-slate-300 text-xs">—</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {entry.office_surveyor?.full_name
                              ? <div className="inline-flex justify-center"><StaffAvatar name={entry.office_surveyor.full_name} size="sm" /></div>
                              : <span className="text-slate-300 text-xs">—</span>
                            }
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={entry.status} />
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs truncate max-w-[140px]">{client}</td>
                          <td
                            className="px-4 py-2.5 text-slate-500 text-xs max-w-[180px] truncate"
                            title={entry.notes ?? undefined}
                          >
                            {entry.notes ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <SurveyorSummary entries={dayEntries} fieldSurveyors={fieldSurveyors} />
          </div>
        )
      })}

      {/* Detail / edit modal */}
      <ScheduleEntryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        entry={editingEntry}
        prefillDate={prefillDate}
        projects={projects}
        allTasks={allTasks}
        fieldSurveyors={fieldSurveyors}
        officeSurveyors={officeSurveyors}
        equipment={equipment}
        allStaff={allStaff}
        allEntries={initialEntries}
        canEdit={canEdit}
      />
    </div>
  )
}
