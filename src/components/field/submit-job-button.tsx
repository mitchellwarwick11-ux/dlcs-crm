'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Loader2, Send, AlertTriangle } from 'lucide-react'

interface Props {
  entryId:         string
  projectId:       string
  taskId:          string | null
  taskTitle:       string | null
  staffId:         string
  staffRole:       string
  workDate:        string
  timeLogId:       string | null
  timeEntryId:     string | null  // unused but kept for future use
  timeLogNotes:    string | null  // task description from time log form
  totalHours:      number | null
  isOvertime:      boolean
  jsaDone:         boolean
  alreadyComplete: boolean
}

export function SubmitJobButton({
  entryId, projectId, taskId, taskTitle, staffId, staffRole,
  workDate, timeLogId, timeEntryId, timeLogNotes, totalHours, isOvertime,
  jsaDone, alreadyComplete,
}: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(alreadyComplete)
  const [error,      setError]      = useState<string | null>(null)

  const canSubmit = !!timeLogId && !!totalHours

  async function handleSubmit() {
    if (!canSubmit) return
    if (!confirm('Submit this job? This will mark it complete and post your hours to the timesheet.')) return

    setSubmitting(true)
    setError(null)
    const db = createClient() as any

    // 1 ─ Look up rate: project-specific → role default → 0
    let rate = 0
    const { data: projRate } = await db
      .from('project_staff_rates')
      .select('hourly_rate')
      .eq('project_id', projectId)
      .eq('staff_id', staffId)
      .maybeSingle()

    if (projRate) {
      rate = projRate.hourly_rate
    } else {
      const { data: roleRate } = await db
        .from('role_rates')
        .select('hourly_rate')
        .eq('role_key', staffRole)
        .maybeSingle()
      if (roleRate) rate = roleRate.hourly_rate
    }

    // Use the surveyor's task description if provided; otherwise null
    // (task title is already shown in the TASK column via task_id — no need to duplicate it here)
    const description = timeLogNotes?.trim() || null

    // 2 ─ Check for an existing time entry for this project/staff/date
    //     Try by task_id first (most specific), then fall back to description pattern
    //     (handles re-submits without duplicating rows)
    let existingEntry: { id: string } | null = null
    if (taskId) {
      const { data } = await db
        .from('time_entries')
        .select('id')
        .eq('project_id', projectId)
        .eq('staff_id',   staffId)
        .eq('date',       workDate)
        .eq('task_id',    taskId)
        .maybeSingle()
      existingEntry = data
    }
    if (!existingEntry) {
      // Fallback: match old-style entries created by the field app before task_id was added
      const { data } = await db
        .from('time_entries')
        .select('id')
        .eq('project_id', projectId)
        .eq('staff_id',   staffId)
        .eq('date',       workDate)
        .ilike('description', 'Field work%')
        .maybeSingle()
      existingEntry = data
    }

    if (existingEntry) {
      // Re-submitting — update existing time entry
      await db
        .from('time_entries')
        .update({
          hours:        totalHours,
          rate_at_time: rate,
          description,
          task_id:      taskId ?? null,
          updated_at:   new Date().toISOString(),
        })
        .eq('id', existingEntry.id)
    } else {
      // First submission — insert new time entry
      const { data: newEntry, error: insertErr } = await db
        .from('time_entries')
        .insert({
          project_id:   projectId,
          staff_id:     staffId,
          date:         workDate,
          hours:        totalHours,
          description,
          task_id:      taskId ?? null,
          is_billable:  true,
          rate_at_time: rate,
        })
        .select('id')
        .single()

      if (insertErr || !newEntry) {
        setError('Failed to post hours to timesheet.')
        setSubmitting(false)
        return
      }

      // Try to link back to field_time_log (works once migration is run, silently skips if not)
      if (timeLogId) {
        await db
          .from('field_time_logs')
          .update({ time_entry_id: newEntry.id })
          .eq('id', timeLogId)
      }
    }

    // 3 ─ Mark schedule entry as completed
    const { error: updateErr } = await db
      .from('field_schedule_entries')
      .update({ status: 'completed' })
      .eq('id', entryId)

    if (updateErr) {
      setError('Hours posted but failed to mark entry complete.')
      setSubmitting(false)
      return
    }

    setDone(true)
    setSubmitting(false)
    router.refresh()
  }

  // Already complete — show badge, but allow re-submission to fix/update the timesheet entry
  if (done) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 py-4 px-5 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <span className="text-sm font-semibold text-green-700">Job submitted — hours posted to timesheet</span>
        </div>
        <button
          onClick={() => setDone(false)}
          className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors py-1"
        >
          Need to update? Re-submit timesheet entry →
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Warnings */}
      {!jsaDone && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">Risk Assessment not yet completed.</p>
        </div>
      )}
      {isOvertime && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
          <p className="text-xs text-orange-700">Overtime recorded — manager approval required.</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !canSubmit}
        className={`w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
          canSubmit
            ? 'bg-green-600 hover:bg-green-700 text-white active:scale-[0.98]'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        {submitting
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
          : <><Send className="h-4 w-4" /> Submit Day &amp; Post to Timesheet</>
        }
      </button>

      {!canSubmit && (
        <p className="text-xs text-slate-400 text-center">
          Complete the Time Log before submitting.
        </p>
      )}
    </div>
  )
}
