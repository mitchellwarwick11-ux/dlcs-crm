'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, formatHours, stripJobNumberPrefix } from '@/lib/utils/formatters'
import { DeleteTimeEntryButton } from './delete-time-entry-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, X, Check, Loader2, ArrowRightLeft, Receipt } from 'lucide-react'
import Link from 'next/link'

export interface TimeEntryData {
  id: string
  date: string
  hours: number
  description: string | null
  is_billable: boolean
  rate_at_time: number
  invoice_item_id: string | null
  invoice_number?: string | null
  is_variation?: boolean
  acting_role?: string | null
  task_id: string | null
  staff_id: string
  project_id: string
  job_number?: string
  staff_profiles: { full_name: string; role?: string } | null
  project_tasks: { title: string } | null
  projects?: { job_number: string; title: string } | null
}

interface StaffMember { id: string; full_name: string }
interface Task { id: string; project_id: string; title: string; status?: string }

interface TimeEntryRowProps {
  entry: TimeEntryData
  staff: StaffMember[]
  tasks: Task[]
  variant: 'job' | 'timesheet'
}

interface ProjectOption { id: string; job_number: string; title: string }

export function TimeEntryRow({ entry, staff, tasks, variant }: TimeEntryRowProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [mode, setMode] = useState<'view' | 'edit' | 'move'>('view')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [date, setDate]           = useState(entry.date)
  const [hours, setHours]         = useState(String(entry.hours))
  const [taskId, setTaskId]       = useState(entry.task_id ?? '')
  const [staffId, setStaffId]     = useState(entry.staff_id)
  const [description, setDesc]    = useState(entry.description ?? '')
  const [isBillable, setBillable] = useState(entry.is_billable)

  // Move state
  const [projects, setProjects]     = useState<ProjectOption[]>([])
  const [loadingProjs, setLoadingProjs] = useState(false)
  const [targetProjectId, setTargetId]  = useState('')

  const invoiced = !!entry.invoice_item_id
  const amount   = entry.hours * entry.rate_at_time
  const projectTasks = tasks.filter(t =>
    t.project_id === entry.project_id && t.status !== 'completed' && t.status !== 'cancelled'
  )

  function handleCancel() {
    setDate(entry.date); setHours(String(entry.hours)); setTaskId(entry.task_id ?? '')
    setStaffId(entry.staff_id); setDesc(entry.description ?? ''); setBillable(entry.is_billable)
    setError(null); setMode('view')
  }

  async function handleSave() {
    const parsedHours = parseFloat(hours)
    if (!date || isNaN(parsedHours) || parsedHours <= 0) {
      setError('Date and valid hours are required.'); return
    }
    setSaving(true); setError(null)
    const { error: err } = await (createClient() as any)
      .from('time_entries')
      .update({ date, hours: parsedHours, task_id: taskId || null, staff_id: staffId,
                description: description.trim() || null, is_billable: isBillable })
      .eq('id', entry.id)
    setSaving(false)
    if (err) { setError('Failed to save. Please try again.'); return }
    setMode('view')
    startTransition(() => router.refresh())
  }

  async function handleOpenMove() {
    setMode('move'); setTargetId(''); setError(null)
    if (projects.length > 0) return
    setLoadingProjs(true)
    const { data } = await (createClient() as any)
      .from('projects')
      .select('id, job_number, title')
      .in('status', ['active', 'on_hold'])
      .order('job_number', { ascending: false })
    setProjects(data ?? [])
    setLoadingProjs(false)
  }

  async function handleMove() {
    if (!targetProjectId) { setError('Select a destination job.'); return }
    setSaving(true); setError(null)
    const { error: err } = await (createClient() as any)
      .from('time_entries')
      .update({ project_id: targetProjectId, task_id: null })
      .eq('id', entry.id)
    setSaving(false)
    if (err) { setError('Move failed: ' + err.message); return }
    setMode('view')
    startTransition(() => router.refresh())
  }

  const colSpan = variant === 'timesheet' ? 7 : 10

  // ── Move mode ─────────────────────────────────────────────────────────────
  if (mode === 'move') {
    return (
      <tr className="bg-indigo-50 border-y border-indigo-200">
        <td colSpan={colSpan} className="px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-indigo-800">Move to job:</span>
            {loadingProjs ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : (
              <select
                value={targetProjectId}
                onChange={e => setTargetId(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm min-w-[280px]"
              >
                <option value="">— Select destination job —</option>
                {projects
                  .filter(p => p.job_number !== entry.job_number && p.job_number !== entry.projects?.job_number)
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.job_number} — {stripJobNumberPrefix(p.title, p.job_number)}</option>
                  ))}
              </select>
            )}
            <Button size="sm" onClick={handleMove} disabled={saving || !targetProjectId} className="h-7 px-3">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              {saving ? 'Moving…' : 'Confirm Move'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('view')} disabled={saving} className="h-7 px-3">
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </td>
      </tr>
    )
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  if (mode === 'edit') {
    return (
      <tr className="bg-blue-50 border-y border-blue-200">
        <td colSpan={colSpan} className="px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div>
              <p className="text-xs text-slate-500 mb-1">Date</p>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Hours</p>
              <Input type="number" step="0.25" min="0.25" value={hours}
                onChange={e => setHours(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Staff</p>
              <select value={staffId} onChange={e => setStaffId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm h-8">
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Task</p>
              <select value={taskId} onChange={e => setTaskId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm h-8">
                <option value="">— None —</option>
                {projectTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Task Description</p>
              <Input value={description} onChange={e => setDesc(e.target.value)}
                placeholder="Optional" className="h-8 text-sm" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Billable</p>
              <label className="flex items-center gap-2 h-8 cursor-pointer">
                <input type="checkbox" checked={isBillable}
                  onChange={e => setBillable(e.target.checked)} className="rounded border-slate-300" />
                <span className="text-sm text-slate-700">Yes</span>
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </td>
      </tr>
    )
  }

  // ── View mode ─────────────────────────────────────────────────────────────
  const invoiceBadge = invoiced && entry.invoice_number ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
      <Receipt className="h-3 w-3" />{entry.invoice_number}
    </span>
  ) : invoiced ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
      <Receipt className="h-3 w-3" />Invoiced
    </span>
  ) : null

  const actionBtns = (
    <>
      <button onClick={() => !invoiced && setMode('edit')} disabled={invoiced}
        title={invoiced ? 'Cannot edit — entry has been invoiced' : 'Edit entry'}
        className="p-1 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button onClick={handleOpenMove}
        title="Move to a different job"
        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors">
        <ArrowRightLeft className="h-3.5 w-3.5" />
      </button>
      <DeleteTimeEntryButton entryId={entry.id} invoiced={invoiced} />
    </>
  )

  if (variant === 'timesheet') {
    return (
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-4 py-2.5">
          {entry.projects?.job_number ? (
            <Link
              href={`/projects/${entry.projects.job_number}`}
              className="text-slate-700 text-xs truncate hover:text-blue-600 hover:underline"
            >
              {entry.projects.title}
            </Link>
          ) : (
            <span className="text-slate-700 text-xs truncate">{entry.projects?.title}</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-slate-600 text-xs truncate">{entry.staff_profiles?.full_name}</td>
        <td className="px-4 py-2.5 text-slate-600 text-xs truncate">
          {entry.is_variation && (
            <span
              className="inline-flex items-center justify-center w-4 h-4 mr-1.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 align-middle"
              title="Variation to fixed fee"
            >V</span>
          )}
          {entry.project_tasks?.title ?? <span className="text-slate-300">—</span>}
        </td>
        <td className="px-4 py-2.5 text-slate-400 text-xs truncate">{entry.description ?? <span className="text-slate-300">—</span>}</td>
        <td className="px-4 py-2.5 text-right font-medium text-slate-800 text-xs whitespace-nowrap">{formatHours(entry.hours)}</td>
        <td className="px-4 py-2.5 text-center">
          {entry.is_billable
            ? <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Billable" />
            : <span className="inline-block w-2 h-2 rounded-full bg-slate-300" title="Non-billable" />}
        </td>
        <td className="px-2 py-2.5 text-right whitespace-nowrap">{actionBtns}</td>
      </tr>
    )
  }

  // variant === 'job'
  return (
    <tr className={`transition-colors ${invoiced ? 'bg-emerald-50 text-slate-500 hover:bg-emerald-100' : 'hover:bg-slate-50'}`}>
      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDate(entry.date)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-slate-800 font-medium text-sm">{entry.staff_profiles?.full_name ?? '—'}</p>
        {(() => {
          const displayRole = entry.acting_role ?? entry.staff_profiles?.role
          if (!displayRole) return null
          const isOverride = !!entry.acting_role && entry.acting_role !== entry.staff_profiles?.role
          return (
            <p className={`text-xs capitalize ${isOverride ? 'text-amber-700 font-medium' : 'text-slate-400'}`}
               title={isOverride ? `Acting role (default: ${entry.staff_profiles?.role?.replace(/_/g, ' ')})` : undefined}>
              {displayRole.replace(/_/g, ' ')}{isOverride ? ' *' : ''}
            </p>
          )
        })()}
      </td>
      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
        {entry.is_variation && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 mr-1.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 align-middle"
            title="Variation to fixed fee"
          >V</span>
        )}
        {entry.project_tasks?.title ?? <span className="text-slate-400">—</span>}
      </td>
      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{entry.description ?? <span className="text-slate-300">—</span>}</td>
      <td className="px-4 py-3 text-right text-slate-800 font-medium whitespace-nowrap">{formatHours(entry.hours)}</td>
      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">{formatCurrency(entry.rate_at_time)}/h</td>
      <td className="px-4 py-3 text-right text-slate-800 font-medium whitespace-nowrap">
        {entry.is_billable ? formatCurrency(amount) : <span className="text-slate-400">—</span>}
      </td>
      <td className="px-4 py-3 text-center">
        {entry.is_billable
          ? <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Billable" />
          : <span className="inline-block w-2 h-2 rounded-full bg-slate-300" title="Non-billable" />}
      </td>
      <td className="px-4 py-3">{invoiceBadge}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{actionBtns}</td>
    </tr>
  )
}
