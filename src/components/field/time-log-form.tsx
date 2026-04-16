'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'

interface Props {
  entryId:   string
  staffId:   string
  workDate:  string   // 'yyyy-MM-dd'
  existing?: {
    start_time:    string
    end_time:      string
    break_minutes: number
    total_hours:   number
    is_overtime:   boolean
    notes:         string | null
  } | null
}

function calcTotalHours(start: string, end: string, breakMins: number): number | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if (isNaN(sh) || isNaN(eh)) return null
  let startTotal = sh * 60 + sm
  let endTotal   = eh * 60 + em
  if (endTotal <= startTotal) endTotal += 24 * 60  // handles past-midnight
  const worked = endTotal - startTotal - breakMins
  if (worked <= 0) return null
  return Math.round(worked / 60 * 100) / 100
}

export function TimeLogForm({ entryId, staffId, workDate, existing }: Props) {
  const router = useRouter()

  const [startTime,   setStartTime]   = useState(existing?.start_time    ?? '')
  const [endTime,     setEndTime]     = useState(existing?.end_time       ?? '')
  const [breakMins,   setBreakMins]   = useState(existing?.break_minutes  ?? 0)
  const [notes,       setNotes]       = useState(existing?.notes          ?? '')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [done,        setDone]        = useState(false)

  const totalHours  = calcTotalHours(startTime, endTime, breakMins)
  const isOvertime  = totalHours != null && totalHours > 8

  async function handleSubmit() {
    if (!startTime || !endTime) { setError('Start and end times are required.'); return }
    if (totalHours === null) { setError('End time must be after start time.'); return }
    if (!notes.trim()) { setError('Task Description is required.'); return }

    setSaving(true)
    setError(null)
    const db = createClient() as any

    const { error: dbErr } = await db
      .from('field_time_logs')
      .upsert({
        entry_id:       entryId,
        staff_id:       staffId,
        work_date:      workDate,
        start_time:     startTime,
        end_time:       endTime,
        break_minutes:  breakMins,
        total_hours:    totalHours,
        is_overtime:    isOvertime,
        notes:          notes.trim() || null,
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'entry_id,staff_id' })

    if (dbErr) {
      setError('Failed to save. Please try again.')
      setSaving(false)
      return
    }

    setDone(true)
    router.refresh()
    setTimeout(() => router.push(`/field/${entryId}`), 1500)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
        <CheckCircle2 className="h-14 w-14 text-green-500 mb-4" />
        <p className="text-lg font-bold text-slate-800">Time Logged</p>
        {isOvertime && (
          <p className="text-sm text-orange-600 mt-1 font-medium">Overtime recorded — your manager has been notified.</p>
        )}
        <p className="text-sm text-slate-500 mt-1">Returning to job hub…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-5 space-y-6">

        {/* Start time */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-2">Start time</label>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-4 py-3.5 text-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* End time */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-2">End time</label>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-4 py-3.5 text-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Break */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-2">Break duration</label>
          <div className="flex items-center gap-3">
            {[0, 15, 30, 45, 60].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => setBreakMins(mins)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                  breakMins === mins
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {mins === 0 ? 'None' : `${mins}m`}
              </button>
            ))}
          </div>
          {/* Custom break minutes */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="5"
              value={breakMins}
              onChange={e => setBreakMins(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-500">minutes (custom)</span>
          </div>
        </div>

        {/* Total hours summary */}
        {totalHours !== null && (
          <div className={`rounded-xl p-4 border ${
            isOvertime
              ? 'bg-orange-50 border-orange-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center gap-2">
              <Clock className={`h-5 w-5 ${isOvertime ? 'text-orange-500' : 'text-green-600'}`} />
              <div>
                <p className={`text-lg font-bold ${isOvertime ? 'text-orange-700' : 'text-green-700'}`}>
                  {totalHours}h total
                </p>
                {isOvertime && (
                  <p className="text-sm text-orange-600 font-medium">
                    {(totalHours - 8).toFixed(2)}h overtime — requires manager approval
                  </p>
                )}
                {!isOvertime && (
                  <p className="text-sm text-green-600">
                    Standard hours ✓
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Task Description */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            Task Description
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe the work carried out today, e.g. 'Set out columns for Stage 2, checked as-built levels'"
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-slate-400 mt-1.5">This will appear as the Task Description in the timesheet.</p>
        </div>

        {isOvertime && (
          <div className="flex items-start gap-2 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <p className="text-sm text-orange-700">
              <span className="font-semibold">Overtime requires approval.</span>{' '}
              Submitting this will notify your Project Manager. Please include a note explaining the overtime.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || totalHours === null || !notes.trim()}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving…' : existing ? 'Update Time Log' : 'Submit Time Log'}
        </button>

        <div className="pb-8" />
      </div>
    </div>
  )
}
