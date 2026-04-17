'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, X, CalendarDays, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format, parseISO } from 'date-fns'
import type { ScheduleEntryFull, FieldScheduleStatus } from '@/types/database'

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

// AM / PM / Any toggle group
function TimeOfDayToggle({
  value,
  onChange,
  disabled,
}: {
  value: 'am' | 'pm' | null
  onChange: (v: 'am' | 'pm' | null) => void
  disabled?: boolean
}) {
  const base    = 'px-3 py-1.5 text-xs font-medium transition-colors'
  const active  = 'bg-blue-600 text-white'
  const inactive = 'bg-white text-slate-600 hover:bg-slate-50'

  return (
    <div className={`inline-flex rounded-md border border-slate-300 overflow-hidden ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <button type="button" onClick={() => onChange('am')}  className={`${base} ${value === 'am'  ? active : inactive}`}>AM</button>
      <button type="button" onClick={() => onChange('pm')}  className={`${base} border-l border-slate-300 ${value === 'pm'  ? active : inactive}`}>PM</button>
      <button type="button" onClick={() => onChange(null)}  className={`${base} border-l border-slate-300 ${value === null  ? 'bg-slate-100 text-slate-600' : inactive}`}>Any</button>
    </div>
  )
}

export function ScheduleEntryModal({
  open,
  onOpenChange,
  entry,
  prefillDate,
  projects,
  allTasks,
  officeSurveyors,
  equipment,
  allStaff,
  allEntries,
  canEdit = true,
}: Props) {
  const router  = useRouter()
  const isEdit  = entry !== null

  const [date,          setDate]          = useState('')
  const [projectId,     setProjectId]     = useState('')
  const [taskId,        setTaskId]        = useState('')
  const [officeSurvId,  setOfficeSurvId]  = useState('')
  const [hours,         setHours]         = useState('')
  const [timeOfDay,     setTimeOfDay]     = useState<'am' | 'pm' | null>(null)
  const [status,        setStatus]        = useState<FieldScheduleStatus>('scheduled')
  const [notes,         setNotes]         = useState('')
  const [surveyorIds,   setSurveyorIds]   = useState<string[]>([])
  const [resourceIds,   setResourceIds]   = useState<string[]>([])
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (isEdit && entry) {
      setDate(entry.date)
      setProjectId(entry.project_id)
      setTaskId(entry.task_id ?? '')
      setOfficeSurvId(entry.office_surveyor_id ?? '')
      setHours(entry.hours != null ? String(entry.hours) : '')
      setTimeOfDay(entry.time_of_day ?? null)
      setStatus(entry.status)
      setNotes(entry.notes ?? '')
      setSurveyorIds(entry.field_surveyors.map(s => s.id))
      setResourceIds(entry.resources.map(r => r.id))
    } else {
      setDate(prefillDate)
      setProjectId('')
      setTaskId('')
      setOfficeSurvId('')
      setHours('')
      setTimeOfDay(null)
      setStatus('scheduled')
      setNotes('')
      setSurveyorIds([])
      setResourceIds([])
    }
    setError(null)
  }, [open, entry, prefillDate, isEdit])

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

    setSaving(true)
    setError(null)
    const db = createClient() as any

    const payload = {
      date,
      project_id:         projectId,
      task_id:            taskId        || null,
      office_surveyor_id: officeSurvId  || null,
      hours:              hours ? parseFloat(hours) : null,
      time_of_day:        timeOfDay,
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
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col">

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
                  <option key={p.id} value={p.id}>{p.job_number} — {p.title}</option>
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

            {/* Hours */}
            <div>
              <Label htmlFor="se-hours">Hours</Label>
              <Input
                id="se-hours"
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 4"
                value={hours}
                onChange={e => setHours(e.target.value)}
                disabled={ro}
                className="mt-1 disabled:bg-slate-50"
              />
            </div>

            {/* Time of Day */}
            <div>
              <Label className="block mb-1.5">Time of Day</Label>
              <TimeOfDayToggle value={timeOfDay} onChange={setTimeOfDay} disabled={ro} />
            </div>

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

            {/* Notes */}
            <div>
              <Label htmlFor="se-notes">Notes <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
              <textarea
                id="se-notes"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={ro}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Any additional notes…"
              />
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

            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            {(isEdit && canEdit) ? (
              <button
                type="button"
                onClick={handleDelete}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                Delete entry
              </button>
            ) : <div />}
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
