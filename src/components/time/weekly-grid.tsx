'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { formatHours, stripJobNumberPrefix } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { Plus, Copy, Loader2, X } from 'lucide-react'

export interface GridProject {
  id: string
  job_number: string
  title: string
  is_billable: boolean
  client_name?: string | null
}

export interface GridTask {
  id: string
  project_id: string
  title: string
}

export interface GridStaff {
  id: string
  default_hourly_rate: number
}

export interface GridEntry {
  id: string
  project_id: string
  task_id: string | null
  date: string
  hours: number
  description: string | null
  is_billable: boolean
  rate_at_time: number
  invoice_item_id: string | null
}

interface Props {
  weekDays: string[]             // 7 yyyy-MM-dd strings Mon..Sun
  prevWeekStart: string          // yyyy-MM-dd Monday of previous week
  entries: GridEntry[]           // current week entries (current user only)
  prevEntries: GridEntry[]       // previous week entries (used for copy)
  projects: GridProject[]
  tasks: GridTask[]
  staffId: string | null
  staffRate: number
  staffRole: string | null
}

type RowKey = string // `${project_id}|${task_id ?? 'none'}`

function rowKey(projectId: string, taskId: string | null): RowKey {
  return `${projectId}|${taskId ?? 'none'}`
}

function cellKey(projectId: string, taskId: string | null, date: string) {
  return `${rowKey(projectId, taskId)}|${date}`
}

interface CellData {
  hours: number
  entryIds: string[]   // all entry ids for this cell
  isBillable: boolean
  rate: number
  anyInvoiced: boolean
  description: string
}

export function WeeklyGrid({
  weekDays, prevWeekStart, entries, prevEntries, projects, tasks, staffId, staffRate, staffRole,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const supabase = createClient() as any

  // Build initial rows from existing entries
  const initialRows = useMemo(() => {
    const seen = new Set<RowKey>()
    const rows: { project_id: string; task_id: string | null }[] = []
    for (const e of entries) {
      const k = rowKey(e.project_id, e.task_id)
      if (!seen.has(k)) {
        seen.add(k)
        rows.push({ project_id: e.project_id, task_id: e.task_id })
      }
    }
    return rows
  }, [entries])

  const [extraRows, setExtraRows] = useState<{ project_id: string; task_id: string | null }[]>([])
  const rows = [...initialRows, ...extraRows.filter(r =>
    !initialRows.some(ir => ir.project_id === r.project_id && ir.task_id === r.task_id)
  )]

  // Build cells map from entries
  const [cells, setCells] = useState<Record<string, CellData>>(() => {
    const m: Record<string, CellData> = {}
    for (const e of entries) {
      const k = cellKey(e.project_id, e.task_id, e.date)
      const existing = m[k]
      if (existing) {
        existing.hours += e.hours
        existing.entryIds.push(e.id)
        if (e.invoice_item_id) existing.anyInvoiced = true
        if (e.description) {
          existing.description = existing.description
            ? existing.description + ' | ' + e.description
            : e.description
        }
      } else {
        m[k] = {
          hours: e.hours,
          entryIds: [e.id],
          isBillable: e.is_billable,
          rate: e.rate_at_time,
          anyInvoiced: !!e.invoice_item_id,
          description: e.description ?? '',
        }
      }
    }
    return m
  })

  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [copying, setCopying] = useState(false)
  const [activeCell, setActiveCell] = useState<{ rowK: RowKey; date: string } | null>(null)
  // Pending cells: hours typed but not yet persisted because description is missing.
  const [pendingCells, setPendingCells] = useState<Record<string, { hours: number }>>({})
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({})

  const hasUnsaved = Object.keys(pendingCells).length > 0
  useEffect(() => {
    if (!hasUnsaved) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsaved])

  async function saveDescription(projectId: string, taskId: string | null, date: string, desc: string) {
    const k = cellKey(projectId, taskId, date)
    const trimmed = desc.trim()
    const prev = cells[k]
    const pending = pendingCells[k]

    // Pending cell waiting for a description — persist hours + description together.
    if (pending) {
      if (!trimmed) {
        setCellErrors(ce => ({ ...ce, [k]: 'Description required to save these hours.' }))
        return
      }
      await persistCell(projectId, taskId, date, pending.hours, trimmed)
      return
    }

    if (!prev || prev.entryIds.length === 0) return
    if (prev.anyInvoiced) { setError('Cannot edit an invoiced cell.'); return }
    if (trimmed === (prev.description ?? '').trim()) return
    if (!trimmed) {
      // Refuse to clear an existing description — would re-create the legacy state we are removing.
      setCellErrors(ce => ({ ...ce, [k]: 'Description required.' }))
      return
    }
    setError(null)
    const [firstId] = prev.entryIds
    const { error: uerr } = await supabase
      .from('time_entries').update({ description: trimmed }).eq('id', firstId)
    if (uerr) { setError('Failed to save note: ' + uerr.message); return }
    setCells(c => ({ ...c, [k]: { ...prev, description: trimmed } }))
    setCellErrors(ce => { const n = { ...ce }; delete n[k]; return n })
    startTransition(() => router.refresh())
  }

  function parseHoursInput(raw: string): number | null {
    if (!raw.trim()) return 0
    // Accept "1.5" or "1:30"
    if (raw.includes(':')) {
      const [h, m] = raw.split(':')
      const hh = parseInt(h, 10)
      const mm = parseInt(m, 10)
      if (isNaN(hh) || isNaN(mm)) return null
      return hh + mm / 60
    }
    const n = parseFloat(raw)
    return isNaN(n) ? null : n
  }

  // Delete a cell (used when hours = 0). No description needed.
  async function deleteCell(projectId: string, taskId: string | null, date: string) {
    const k = cellKey(projectId, taskId, date)
    const prev = cells[k]
    if (prev && prev.anyInvoiced) { setError('Cannot edit an invoiced cell.'); return }
    setSavingCell(k); setError(null)
    try {
      if (prev && prev.entryIds.length > 0) {
        const { error: err } = await supabase
          .from('time_entries').delete().in('id', prev.entryIds)
        if (err) throw err
      }
      const copy = { ...cells }; delete copy[k]; setCells(copy)
      const pc = { ...pendingCells }; delete pc[k]; setPendingCells(pc)
      const ce = { ...cellErrors }; delete ce[k]; setCellErrors(ce)
      startTransition(() => router.refresh())
    } catch (e: any) {
      setError('Save failed: ' + (e.message ?? 'unknown error'))
    } finally {
      setSavingCell(null)
    }
  }

  // Persist hours + description together. Used when both are known
  // (either a pending cell now has its description, or an existing cell
  // has hours updated and an existing description is still in place).
  async function persistCell(
    projectId: string, taskId: string | null, date: string, hours: number, description: string,
  ) {
    if (!staffId) { setError('Your staff profile is not linked — cannot save.'); return }
    const trimmed = description.trim()
    if (hours <= 0) return
    if (!trimmed) { setError('Description required.'); return }

    const k = cellKey(projectId, taskId, date)
    const prev = cells[k]
    if (prev && prev.anyInvoiced) { setError('Cannot edit an invoiced cell.'); return }

    setSavingCell(k); setError(null)
    try {
      if (prev && prev.entryIds.length > 0) {
        const [firstId, ...others] = prev.entryIds
        const { error: uerr } = await supabase
          .from('time_entries')
          .update({ hours, description: trimmed })
          .eq('id', firstId)
        if (uerr) throw uerr
        if (others.length > 0) {
          await supabase.from('time_entries').delete().in('id', others)
        }
        setCells({ ...cells, [k]: {
          ...prev, hours, entryIds: [firstId], description: trimmed,
        }})
      } else {
        const project = projects.find(p => p.id === projectId)
        const isBillable = project?.is_billable ?? true
        const { data: override } = staffRole
          ? await supabase
              .from('project_role_rates')
              .select('hourly_rate')
              .eq('project_id', projectId)
              .eq('role_key', staffRole)
              .maybeSingle()
          : { data: null }
        const rate = override?.hourly_rate ?? staffRate
        const { data: inserted, error: ierr } = await supabase
          .from('time_entries').insert({
            project_id: projectId,
            task_id: taskId,
            staff_id: staffId,
            date,
            hours,
            description: trimmed,
            is_billable: isBillable,
            rate_at_time: rate,
          }).select('id').single()
        if (ierr) throw ierr
        setCells({ ...cells, [k]: {
          hours, entryIds: [inserted.id], isBillable, rate, anyInvoiced: false,
          description: trimmed,
        }})
      }
      const pc = { ...pendingCells }; delete pc[k]; setPendingCells(pc)
      const ce = { ...cellErrors }; delete ce[k]; setCellErrors(ce)
      startTransition(() => router.refresh())
    } catch (e: any) {
      setError('Save failed: ' + (e.message ?? 'unknown error'))
    } finally {
      setSavingCell(null)
    }
  }

  // Hours-cell blur handler. Decides whether to delete, persist, or hold pending.
  async function handleHoursBlur(projectId: string, taskId: string | null, date: string, raw: string) {
    if (!staffId) { setError('Your staff profile is not linked — cannot save.'); return }
    const k = cellKey(projectId, taskId, date)
    const parsed = parseHoursInput(raw)
    if (parsed === null) { setError('Invalid hours value.'); return }

    const prev = cells[k]
    if (prev && prev.anyInvoiced) { setError('Cannot edit an invoiced cell.'); return }

    if (parsed === 0) {
      await deleteCell(projectId, taskId, date)
      return
    }

    const existingDesc = (prev?.description ?? '').trim()
    if (existingDesc) {
      // Existing row already has a description — safe to update hours alone.
      if (prev && parsed === prev.hours) return
      await persistCell(projectId, taskId, date, parsed, existingDesc)
      return
    }

    // Hours given but no description on file — hold pending and prompt for description.
    setPendingCells(pc => ({ ...pc, [k]: { hours: parsed } }))
    setCellErrors(ce => ({ ...ce, [k]: 'Description required to save these hours.' }))
    setActiveCell({ rowK: rowKey(projectId, taskId), date })
  }

  async function copyPreviousWeek() {
    if (!staffId) return
    if (prevEntries.length === 0) { setError('Previous week has no entries to copy.'); return }
    if (!confirm('Copy all project/task rows from last week into this week with 0 hours?')) return
    setCopying(true); setError(null)
    // Seed rows (but not entries) — user enters hours per cell
    const seen = new Set<RowKey>()
    rows.forEach(r => seen.add(rowKey(r.project_id, r.task_id)))
    const toAdd: { project_id: string; task_id: string | null }[] = []
    for (const e of prevEntries) {
      const k = rowKey(e.project_id, e.task_id)
      if (!seen.has(k)) { seen.add(k); toAdd.push({ project_id: e.project_id, task_id: e.task_id }) }
    }
    setExtraRows(prev => [...prev, ...toAdd])
    setCopying(false)
  }

  function removeRow(projectId: string, taskId: string | null) {
    // Only allow removing rows with no entries
    const hasEntries = weekDays.some(d => cells[cellKey(projectId, taskId, d)])
    if (hasEntries) { setError('Cannot remove a row with logged hours. Clear the hours first.'); return }
    setExtraRows(prev => prev.filter(r => !(r.project_id === projectId && r.task_id === taskId)))
  }

  // Totals
  const dayTotals = weekDays.map(d =>
    rows.reduce((sum, r) => sum + (cells[cellKey(r.project_id, r.task_id, d)]?.hours ?? 0), 0)
  )
  const rowTotal = (r: { project_id: string; task_id: string | null }) =>
    weekDays.reduce((sum, d) => sum + (cells[cellKey(r.project_id, r.task_id, d)]?.hours ?? 0), 0)
  const grandTotal = dayTotals.reduce((a, b) => a + b, 0)

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Weekly Entry</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyPreviousWeek} disabled={copying || !staffId}>
            {copying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            Copy Previous Week
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} disabled={!staffId}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add A Task
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide w-[28%]">Job / Task</th>
              {weekDays.map(d => {
                const dt = parseISO(d)
                return (
                  <th key={d} className="px-2 py-2 text-center text-xs font-medium text-slate-500">
                    <div>{format(dt, 'EEE')}</div>
                    <div className="text-slate-400 font-normal">{format(dt, 'd MMM')}</div>
                  </th>
                )
              })}
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={weekDays.length + 3} className="px-4 py-10 text-center text-sm text-slate-500">
                  No tasks yet. Click "Add A Task" to get started.
                </td>
              </tr>
            ) : rows.flatMap(r => {
              const project = projects.find(p => p.id === r.project_id)
              const task = tasks.find(t => t.id === r.task_id)
              const rKey = rowKey(r.project_id, r.task_id)
              const isExtra = extraRows.some(er => er.project_id === r.project_id && er.task_id === r.task_id)
                && !initialRows.some(ir => ir.project_id === r.project_id && ir.task_id === r.task_id)
              const showNotes = activeCell && activeCell.rowK === rKey
              const notesCell = showNotes ? cells[cellKey(r.project_id, r.task_id, activeCell.date)] : null
              const elements = [
                <tr key={rKey} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 align-top">
                    <div className="text-sm">
                      <span className="font-mono font-medium text-slate-700">{project?.job_number}</span>
                      <span className="text-slate-600"> — {project?.title}</span>
                      {task ? <span className="text-slate-500"> / {task.title}</span> : null}
                    </div>
                    {project?.client_name && (
                      <div className="text-xs text-slate-400 mt-0.5">{project.client_name}</div>
                    )}
                  </td>
                  {weekDays.map(d => {
                    const cKey = cellKey(r.project_id, r.task_id, d)
                    const cell = cells[cKey]
                    const pending = pendingCells[cKey]
                    const hasError = !!cellErrors[cKey]
                    const locked = !!cell?.anyInvoiced
                    const displayHours = pending
                      ? formatHours(pending.hours)
                      : cell ? formatHours(cell.hours) : ''
                    return (
                      <td key={d} className="px-1.5 py-1.5 align-middle">
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={locked || !staffId || savingCell === cKey}
                          key={cKey + ':' + (cell?.hours ?? 'x') + ':' + (pending?.hours ?? 'x')}
                          defaultValue={displayHours}
                          placeholder=""
                          title={locked ? 'Invoiced — locked' : (cellErrors[cKey] ?? '')}
                          onFocus={() => setActiveCell({ rowK: rKey, date: d })}
                          onBlur={async e => {
                            const raw = e.currentTarget.value
                            const current = pending?.hours ?? cell?.hours ?? 0
                            const parsed = parseHoursInput(raw)
                            if (parsed !== null && parsed !== current) {
                              await handleHoursBlur(r.project_id, r.task_id, d, raw)
                            }
                          }}
                          className={
                            'w-full text-center text-sm rounded border px-1.5 py-1 ' +
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ' +
                            (locked
                              ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                              : hasError
                                ? 'bg-red-50 border-red-400 text-slate-800 ring-1 ring-red-200'
                                : cell
                                  ? 'bg-blue-50 border-blue-200 text-slate-800'
                                  : 'bg-white border-slate-200 text-slate-700')
                          }
                        />
                      </td>
                    )
                  })}
                  <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                    {formatHours(rowTotal(r))}
                  </td>
                  <td className="px-1 py-2.5 text-center">
                    {isExtra && (
                      <button
                        onClick={() => removeRow(r.project_id, r.task_id)}
                        className="text-slate-300 hover:text-red-500 p-1"
                        title="Remove row"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ]
              if (showNotes) {
                const noteDateLabel = format(parseISO(activeCell!.date), 'EEE d MMM')
                const noteCellKey = cellKey(r.project_id, r.task_id, activeCell!.date)
                const notesPending = pendingCells[noteCellKey]
                const noteError = cellErrors[noteCellKey]
                const hasAnyHours = !!notesCell || !!notesPending
                const noteDisabled = !hasAnyHours || (notesCell?.anyInvoiced ?? false)
                elements.push(
                  <tr key={rKey + '-notes'} className={noteError ? 'bg-red-50/60' : 'bg-slate-50/60'}>
                    <td className="px-4 py-3 align-top">
                      <label className="block text-xs font-medium text-slate-600">
                        Task Description {hasAnyHours && <span className="text-red-600">*</span>}
                      </label>
                      <div className="text-xs text-slate-400 mt-0.5">{noteDateLabel}</div>
                      {!hasAnyHours && (
                        <div className="text-xs text-slate-400 mt-1">Enter hours first to attach a description.</div>
                      )}
                      {noteError && (
                        <div className="text-xs text-red-600 mt-1">{noteError}</div>
                      )}
                    </td>
                    <td colSpan={weekDays.length + 2} className="px-2 py-3">
                      <div className="flex items-start gap-2">
                        <textarea
                          key={noteCellKey}
                          defaultValue={notesCell?.description ?? ''}
                          placeholder="Describe the work done…"
                          rows={2}
                          autoFocus={!!notesPending}
                          disabled={noteDisabled}
                          onBlur={e => saveDescription(r.project_id, r.task_id, activeCell!.date, e.currentTarget.value)}
                          className={
                            'flex-1 rounded-md border bg-white px-3 py-2 text-sm resize-y ' +
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ' +
                            'disabled:bg-slate-100 disabled:text-slate-400 ' +
                            (noteError ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200')
                          }
                        />
                        <button
                          onClick={() => setActiveCell(null)}
                          className="text-slate-400 hover:text-slate-700 p-1"
                          title="Close"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td />
                  </tr>
                )
              }
              return elements
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                  Day totals
                </td>
                {dayTotals.map((t, i) => (
                  <td key={i} className="px-2 py-2.5 text-center font-semibold text-slate-800">
                    {formatHours(t)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                  {formatHours(grandTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showAdd && (
        <AddTaskDialog
          projects={projects}
          tasks={tasks}
          existingRows={rows}
          onCancel={() => setShowAdd(false)}
          onAdd={(projectId, taskId) => {
            setExtraRows(prev => [...prev, { project_id: projectId, task_id: taskId }])
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
function AddTaskDialog({
  projects, tasks, existingRows, onCancel, onAdd,
}: {
  projects: GridProject[]
  tasks: GridTask[]
  existingRows: { project_id: string; task_id: string | null }[]
  onCancel: () => void
  onAdd: (projectId: string, taskId: string | null) => void
}) {
  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState('')

  const projectTasks = tasks.filter(t => t.project_id === projectId)

  function handleAdd() {
    if (!projectId) return
    const t = taskId || null
    const exists = existingRows.some(r => r.project_id === projectId && r.task_id === t)
    if (exists) { alert('That project + task row already exists.'); return }
    onAdd(projectId, t)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900">Add A Task</h4>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Project</label>
            <select
              value={projectId}
              onChange={e => { setProjectId(e.target.value); setTaskId('') }}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="">— Select project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.job_number} — {stripJobNumberPrefix(p.title, p.job_number)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Task (optional)</label>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              disabled={!projectId}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50"
            >
              <option value="">— No specific task —</option>
              {projectTasks.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={handleAdd} disabled={!projectId}>Add Row</Button>
        </div>
      </div>
    </div>
  )
}
