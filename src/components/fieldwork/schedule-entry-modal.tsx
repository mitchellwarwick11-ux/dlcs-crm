'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, X, CalendarDays, ChevronDown, History, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format, parseISO } from 'date-fns'
import type { ScheduleEntryFull, FieldScheduleStatus } from '@/types/database'
import { ScheduleAvailabilityCalendar } from './schedule-availability-calendar'
import { stripJobNumberPrefix } from '@/lib/utils/formatters'

interface StaffOption     { id: string; full_name: string; role?: string }
interface EquipmentOption { id: string; label: string }
interface TaskOption      { id: string; project_id: string; title: string }
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
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: ScheduleEntryFull | null
  prefillDate: string
  prefillProjectId?: string
  prefillTaskId?: string
  projects: ProjectOption[]
  allTasks: TaskOption[]
  fieldSurveyors: StaffOption[]
  officeSurveyors: StaffOption[]
  equipment: EquipmentOption[]
  allStaff: StaffOption[]
  allEntries: ScheduleEntryFull[]
  canEdit?: boolean
}

const STATUS_OPTIONS: { value: FieldScheduleStatus; label: string }[] = [
  { value: 'must_happen', label: 'Must Happen' },
  { value: 'asap',        label: 'ASAP'        },
  { value: 'scheduled',   label: 'Scheduled'   },
  { value: 'completed',   label: 'Completed'   },
  { value: 'cancelled',   label: 'Cancelled'   },
]

// Grouped surveyor select: collapsed dropdown, expands on click
function GroupedSurveyorSelect({
  allStaff,
  selected,
  onChange,
  disabled,
}: {
  allStaff: StaffOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fieldGroup = allStaff.filter(s => s.role === 'field_surveyor')
  const otherGroup = allStaff.filter(s => s.role !== 'field_surveyor')
  const selectedNames = allStaff
    .filter(s => selected.includes(s.id))
    .map(s => s.full_name)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div ref={ref} className={`relative ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        <span className={selectedNames.length > 0 ? 'text-slate-700 truncate' : 'text-slate-400'}>
          {selectedNames.length === 0
            ? '— Select surveyors —'
            : selectedNames.length === 1
            ? selectedNames[0]
            : `${selectedNames.length} selected`}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {fieldGroup.length > 0 && (
            <>
              <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                Field Surveyors
              </div>
              {fieldGroup.map(s => (
                <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm select-none border-t border-slate-50">
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="rounded border-slate-300 h-3.5 w-3.5" />
                  <span className="text-slate-700">{s.full_name}</span>
                </label>
              ))}
            </>
          )}
          {otherGroup.length > 0 && (
            <>
              <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-t border-slate-200">
                Other Staff
              </div>
              {otherGroup.map(s => (
                <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm select-none border-t border-slate-50">
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="rounded border-slate-300 h-3.5 w-3.5" />
                  <span className="text-slate-700">{s.full_name}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Compact equipment checkboxes displayed as a flex row
function EquipmentRow({
  equipment,
  selected,
  onChange,
  disabled,
}: {
  equipment: EquipmentOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-2 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {equipment.map(e => (
        <label key={e.id} className="flex items-center gap-1.5 cursor-pointer text-sm select-none">
          <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} className="rounded border-slate-300 h-3.5 w-3.5" />
          <span className="text-slate-700">{e.label}</span>
        </label>
      ))}
    </div>
  )
}

// AM / PM / Any toggle group. `null` here = nothing chosen yet (validation will block save).
type TimeOfDayChoice = 'am' | 'pm' | 'any'
function TimeOfDayToggle({
  value,
  onChange,
  disabled,
}: {
  value: TimeOfDayChoice | null
  onChange: (v: TimeOfDayChoice) => void
  disabled?: boolean
}) {
  const base    = 'px-3 py-1.5 text-xs font-medium transition-colors'
  const active  = 'bg-blue-600 text-white'
  const inactive = 'bg-white text-slate-600 hover:bg-slate-50'

  return (
    <div className={`inline-flex rounded-md border border-slate-300 overflow-hidden ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <button type="button" onClick={() => onChange('am')}  className={`${base} ${value === 'am'  ? active : inactive}`}>AM</button>
      <button type="button" onClick={() => onChange('pm')}  className={`${base} border-l border-slate-300 ${value === 'pm'  ? active : inactive}`}>PM</button>
      <button type="button" onClick={() => onChange('any')} className={`${base} border-l border-slate-300 ${value === 'any' ? active : inactive}`}>Any</button>
    </div>
  )
}

export function ScheduleEntryModal({
  open,
  onOpenChange,
  entry,
  prefillDate,
  prefillProjectId,
  prefillTaskId,
  projects,
  allTasks,
  fieldSurveyors,
  officeSurveyors,
  equipment,
  allStaff,
  allEntries,
  canEdit = true,
}: Props) {
  const dailyCapacity = Math.max(1, fieldSurveyors.length) * 8
  const router  = useRouter()
  const isEdit  = entry !== null

  const [date,          setDate]          = useState('')
  const [projectId,     setProjectId]     = useState('')
  const [taskId,        setTaskId]        = useState('')
  const [officeSurvId,  setOfficeSurvId]  = useState('')
  const [hours,         setHours]         = useState('')
  const [timeOfDay,     setTimeOfDay]     = useState<TimeOfDayChoice | null>(null)
  const [status,        setStatus]        = useState<FieldScheduleStatus>('scheduled')
  const [notes,         setNotes]         = useState('')
  const [surveyorIds,   setSurveyorIds]   = useState<string[]>([])
  const [resourceIds,   setResourceIds]   = useState<string[]>([])
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [prevVisits,    setPrevVisits]    = useState<{ staff_id: string; full_name: string; last_date: string; visit_count: number }[]>([])
  const [prevLoading,   setPrevLoading]   = useState(false)
  const [copyOpen,      setCopyOpen]      = useState(false)
  const [copyDate,      setCopyDate]      = useState('')
  const [copying,       setCopying]       = useState(false)

  useEffect(() => {
    if (!open) return
    if (isEdit && entry) {
      setDate(entry.date)
      setProjectId(entry.project_id)
      setTaskId(entry.task_id ?? '')
      setOfficeSurvId(entry.office_surveyor_id ?? '')
      setHours(entry.hours != null ? String(entry.hours) : '')
      setTimeOfDay(entry.time_of_day ?? 'any')
      setStatus(entry.status)
      setNotes(entry.notes ?? '')
      setSurveyorIds(entry.field_surveyors.map(s => s.id))
      setResourceIds(entry.resources.map(r => r.id))
    } else {
      setDate(prefillDate)
      setProjectId(prefillProjectId ?? '')
      setTaskId(prefillTaskId ?? '')
      setOfficeSurvId('')
      setHours('')
      setTimeOfDay(null)
      setStatus('scheduled')
      setNotes('')
      setSurveyorIds([])
      setResourceIds([])
    }
    setError(null)
    setCopyOpen(false)
    setCopyDate('')
  }, [open, entry, prefillDate, prefillProjectId, prefillTaskId, isEdit])

  // Load history of field surveyors who've logged time on this project
  useEffect(() => {
    if (!open || !projectId) { setPrevVisits([]); return }
    let cancelled = false
    ;(async () => {
      setPrevLoading(true)
      const db = createClient() as any
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data, error: qErr } = await db
        .from('time_entries')
        .select('date, staff_id, staff_profiles!time_entries_staff_id_fkey ( id, full_name, role )')
        .eq('project_id', projectId)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(2000)
      if (cancelled) return
      if (qErr) console.error('[previous site visits] query error:', qErr)

      const byStaff = new Map<string, { staff_id: string; full_name: string; last_date: string; dates: Set<string> }>()
      for (const row of (data ?? []) as any[]) {
        const sp = row.staff_profiles
        if (!sp || sp.role !== 'field_surveyor') continue
        const existing = byStaff.get(sp.id)
        if (!existing) {
          byStaff.set(sp.id, { staff_id: sp.id, full_name: sp.full_name, last_date: row.date, dates: new Set([row.date]) })
        } else {
          existing.dates.add(row.date)
          if (row.date > existing.last_date) existing.last_date = row.date
        }
      }
      const list = Array.from(byStaff.values())
        .map(v => ({ staff_id: v.staff_id, full_name: v.full_name, last_date: v.last_date, visit_count: v.dates.size }))
        .sort((a, b) => b.last_date.localeCompare(a.last_date))
      setPrevVisits(list)
      setPrevLoading(false)
    })()
    return () => { cancelled = true }
  }, [open, projectId])

  const tasksForProject  = allTasks.filter(t => t.project_id === projectId)
  const selectedProject  = projects.find(p => p.id === projectId)

  // Other days this project+task is also scheduled (in the loaded window)
  const otherDays = allEntries
    .filter(e =>
      e.id !== entry?.id &&
      e.project_id === (projectId || entry?.project_id) &&
      (taskId ? e.task_id === taskId : entry?.task_id ? e.task_id === entry.task_id : true)
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) { setError('Select a project.'); return }
    const hoursNum = parseFloat(hours)
    if (!hours.trim() || isNaN(hoursNum) || hoursNum <= 0) {
      setError('Enter the hours for this entry.')
      return
    }
    if (!timeOfDay) {
      setError('Select AM, PM, or Any.')
      return
    }

    setSaving(true)
    setError(null)
    const db = createClient() as any

    const payload = {
      date,
      project_id:         projectId,
      task_id:            taskId        || null,
      office_surveyor_id: officeSurvId  || null,
      hours:              hoursNum,
      time_of_day:        timeOfDay === 'any' ? null : timeOfDay,
      status,
      notes:              notes.trim() || null,
    }

    if (isEdit && entry) {
      const { error: upErr } = await db
        .from('field_schedule_entries')
        .update(payload)
        .eq('id', entry.id)
      if (upErr) { setError('Failed to update entry.'); setSaving(false); return }

      await db.from('field_schedule_surveyors').delete().eq('entry_id', entry.id)
      await db.from('field_schedule_resources').delete().eq('entry_id', entry.id)
      if (surveyorIds.length > 0) {
        await db.from('field_schedule_surveyors').insert(
          surveyorIds.map(id => ({ entry_id: entry.id, staff_id: id }))
        )
      }
      if (resourceIds.length > 0) {
        await db.from('field_schedule_resources').insert(
          resourceIds.map(id => ({ entry_id: entry.id, equipment_id: id }))
        )
      }
    } else {
      const { data: { user } } = await (createClient() as any).auth.getUser()
      const { data: newEntry, error: insErr } = await db
        .from('field_schedule_entries')
        .insert({ ...payload, created_by: user?.id ?? null })
        .select('id')
        .single()
      if (insErr || !newEntry) { setError('Failed to save entry.'); setSaving(false); return }

      if (surveyorIds.length > 0) {
        await db.from('field_schedule_surveyors').insert(
          surveyorIds.map(id => ({ entry_id: newEntry.id, staff_id: id }))
        )
      }
      if (resourceIds.length > 0) {
        await db.from('field_schedule_resources').insert(
          resourceIds.map(id => ({ entry_id: newEntry.id, equipment_id: id }))
        )
      }
    }

    router.refresh()
    onOpenChange(false)
    setSaving(false)
  }

  async function handleCopy() {
    if (!entry || !copyDate) return
    setCopying(true)
    setError(null)
    const db = createClient() as any
    const { data: { user } } = await db.auth.getUser()
    const { data: newEntry, error: insErr } = await db
      .from('field_schedule_entries')
      .insert({
        date:               copyDate,
        project_id:         entry.project_id,
        task_id:            entry.task_id,
        office_surveyor_id: entry.office_surveyor_id,
        hours:              entry.hours,
        time_of_day:        entry.time_of_day,
        status:             entry.status,
        notes:              entry.notes,
        created_by:         user?.id ?? null,
      })
      .select('id')
      .single()
    if (insErr || !newEntry) { setError('Failed to copy entry.'); setCopying(false); return }

    if (entry.field_surveyors.length > 0) {
      await db.from('field_schedule_surveyors').insert(
        entry.field_surveyors.map(s => ({ entry_id: newEntry.id, staff_id: s.id }))
      )
    }
    if (entry.resources.length > 0) {
      await db.from('field_schedule_resources').insert(
        entry.resources.map(r => ({ entry_id: newEntry.id, equipment_id: r.id }))
      )
    }

    setCopying(false)
    router.refresh()
    onOpenChange(false)
  }

  async function handleDelete() {
    if (!entry) return
    if (!window.confirm('Delete this schedule entry? This cannot be undone.')) return
    const db = createClient() as any
    await db.from('field_schedule_entries').delete().eq('id', entry.id)
    router.refresh()
    onOpenChange(false)
  }

  if (!open) return null

  const ro = !canEdit // read-only shorthand

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={() => onOpenChange(false)}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit
              ? (ro ? 'Schedule Entry' : 'Edit Schedule Entry')
              : 'Add Schedule Entry'}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Project */}
            <div>
              <Label htmlFor="se-project">Project {!ro && <span className="text-red-500">*</span>}</Label>
              <select
                id="se-project"
                value={projectId}
                onChange={e => { setProjectId(e.target.value); setTaskId('') }}
                disabled={ro}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
                required={!ro}
              >
                <option value="">Select a project…</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.job_number} — {stripJobNumberPrefix(p.title, p.job_number)}</option>
                ))}
              </select>
              {selectedProject && (
                <p className="mt-1 text-xs text-slate-400">
                  {[selectedProject.site_address, selectedProject.suburb].filter(Boolean).join(', ') || 'No address'}
                  {selectedProject.clients && ` · ${selectedProject.clients.company_name ?? selectedProject.clients.name}`}
                </p>
              )}
            </div>

            {/* Task */}
            <div>
              <Label htmlFor="se-task">Task <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
              <select
                id="se-task"
                value={taskId}
                onChange={e => setTaskId(e.target.value)}
                disabled={ro || !projectId}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">No specific task</option>
                {tasksForProject.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            {/* Hours */}
            <div>
              <Label htmlFor="se-hours">Hours <span className="text-red-500">*</span></Label>
              <Input
                id="se-hours"
                type="number"
                min="0"
                step="0.5"
                required
                placeholder="e.g. 4"
                value={hours}
                onChange={e => setHours(e.target.value)}
                disabled={ro}
                className="mt-1 disabled:bg-slate-50"
              />
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="se-status">Status</Label>
              <select
                id="se-status"
                value={status}
                onChange={e => setStatus(e.target.value as FieldScheduleStatus)}
                disabled={ro}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Time of Day */}
            <div>
              <Label className="block mb-1.5">Time of Day <span className="text-red-500">*</span></Label>
              <TimeOfDayToggle value={timeOfDay} onChange={setTimeOfDay} disabled={ro} />
            </div>

            {/* Date */}
            <div>
              <Label htmlFor="se-date">Date</Label>
              <Input
                id="se-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={ro}
                required={!ro}
                className="mt-1 disabled:bg-slate-50"
              />
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                <ScheduleAvailabilityCalendar
                  selectedDate={date}
                  onSelectDate={setDate}
                  entries={allEntries}
                  weeksToShow={4}
                  disabled={ro}
                  dailyCapacityHours={dailyCapacity}
                />
              </div>
            </div>

            {/* Equipment */}
            <div>
              <Label className="block mb-2">Equipment / Resources</Label>
              <EquipmentRow
                equipment={equipment}
                selected={resourceIds}
                onChange={setResourceIds}
                disabled={ro}
              />
            </div>

            {/* Field Surveyors */}
            <div>
              <Label className="mb-1.5 block">Field Surveyor(s) <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
              <GroupedSurveyorSelect
                allStaff={allStaff}
                selected={surveyorIds}
                onChange={setSurveyorIds}
                disabled={ro}
              />
            </div>

            {/* Previous site visits */}
            {projectId && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <History className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Previous Site Visits</span>
                </div>
                {prevLoading ? (
                  <p className="text-xs text-amber-700/70 italic">Loading…</p>
                ) : prevVisits.length === 0 ? (
                  <p className="text-xs text-amber-700/70 italic">No prior surveyor visits recorded for this site.</p>
                ) : (
                  <div className="space-y-1.5">
                    {prevVisits.map(v => (
                      <div key={v.staff_id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-800 font-medium">{v.full_name}</span>
                        <span className="text-slate-600">
                          Last: {format(parseISO(v.last_date), 'd MMM yyyy')}
                          {v.visit_count > 1 && ` · ${v.visit_count} visits`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Office Surveyor */}
            <div>
              <Label htmlFor="se-office">Office Surveyor <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
              <select
                id="se-office"
                value={officeSurvId}
                onChange={e => setOfficeSurvId(e.target.value)}
                disabled={ro}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">— none —</option>
                {officeSurveyors.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>

            {/* Also scheduled panel */}
            {(isEdit || otherDays.length > 0) && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Also Scheduled</span>
                </div>
                {otherDays.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No other days scheduled in this window.</p>
                ) : (
                  <div className="space-y-1.5">
                    {otherDays.map(e => (
                      <div key={e.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium">{format(parseISO(e.date), 'EEE d MMM yyyy')}</span>
                        <span className="text-slate-500">
                          {e.hours ?? 0}h{e.time_of_day ? ` ${e.time_of_day.toUpperCase()}` : ''}
                          {e.field_surveyors.length > 0 && ` · ${e.field_surveyors.map(s => s.full_name.split(' ')[0]).join(', ')}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Brief — shown to the field surveyor on the Job Brief screen */}
            <div>
              <Label htmlFor="se-notes">Brief <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
              <textarea
                id="se-notes"
                rows={4}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={ro}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Instructions for the field surveyor (e.g. site contact, gate code, what to set out)…"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Shown to the field surveyor in the Job Brief section of the Field App.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>

          {/* Copy-to-another-day panel */}
          {isEdit && canEdit && copyOpen && (
            <div className="px-6 py-3 border-t border-slate-200 bg-blue-50/50 shrink-0">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="se-copy-date" className="text-xs">Copy to date</Label>
                  <Input
                    id="se-copy-date"
                    type="date"
                    value={copyDate}
                    onChange={e => setCopyDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleCopy}
                  disabled={copying || !copyDate || copyDate === entry?.date}
                >
                  {copying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Copy
                </Button>
                <Button type="button" variant="outline" onClick={() => { setCopyOpen(false); setCopyDate('') }}>
                  Cancel
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Duplicates this entry (surveyors, equipment, hours, notes) onto the chosen day.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-4">
              {(isEdit && canEdit) && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-sm text-red-500 hover:text-red-700 transition-colors"
                >
                  Delete entry
                </button>
              )}
              {(isEdit && canEdit) && (
                <button
                  type="button"
                  onClick={() => setCopyOpen(o => !o)}
                  className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy to another day
                </button>
              )}
              {!(isEdit && canEdit) && <div />}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {canEdit ? 'Cancel' : 'Close'}
              </Button>
              {canEdit && (
                <Button type="submit" disabled={saving} onClick={handleSubmit as any}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isEdit ? 'Save Changes' : 'Add Entry'}
                </Button>
              )}
            </div>
          </div>

      </div>
    </>
  )
}
