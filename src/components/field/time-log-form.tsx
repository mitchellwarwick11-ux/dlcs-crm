'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'

interface RoleOption {
  role_key: string
  label: string
  hourly_rate: number
}

interface Props {
  entryId:   string
  staffId:   string
  staffRole: string | null
  workDate:  string   // 'yyyy-MM-dd'
  roleRates: RoleOption[]
  existing?: {
    start_time:    string | null
    end_time:      string | null
    break_minutes: number
    total_hours:   number
    is_overtime:   boolean
    notes:         string | null
    acting_role:   string | null
  } | null
}

type Mode = 'times' | 'hours'

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

export function TimeLogForm({ entryId, staffId, staffRole, workDate, roleRates, existing }: Props) {
  const router = useRouter()

  // If the existing record was saved without start/end (hours-only), open in that mode.
  const initialMode: Mode = existing && !existing.start_time && !existing.end_time ? 'hours' : 'times'

  const [mode,        setMode]        = useState<Mode>(initialMode)
  const [startTime,   setStartTime]   = useState(existing?.start_time    ?? '')
  const [endTime,     setEndTime]     = useState(existing?.end_time       ?? '')
  const [breakMins,   setBreakMins]   = useState(existing?.break_minutes  ?? 0)
  const [hoursInput,  setHoursInput]  = useState<string>(
    initialMode === 'hours' && existing ? String(existing.total_hours) : ''
  )
  const [notes,       setNotes]       = useState(existing?.notes          ?? '')
  const [actingRole,  setActingRole]  = useState<string>(
    existing?.acting_role ?? staffRole ?? ''
  )
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [done,        setDone]        = useState(false)

  const totalHoursFromTimes = calcTotalHours(startTime, endTime, breakMins)
  const totalHoursFromInput = (() => {
    const n = parseFloat(hoursInput)
    return isNaN(n) || n <= 0 ? null : Math.round(n * 100) / 100
  })()

  const totalHours = mode === 'times' ? totalHoursFromTimes : totalHoursFromInput
  const isOvertime = totalHours != null && totalHours > 8

  const submitDisabled = saving || totalHours === null || !notes.trim()

  async function handleSubmit() {
    if (mode === 'times') {
      if (!startTime || !endTime) { setError('Start and end times are required.'); return }
      if (totalHoursFromTimes === null) { setError('End time must be after start time.'); return }
    } else {
      if (totalHoursFromInput === null) { setError('Enter the hours onsite (more than 0).'); return }
    }
    if (!notes.trim()) { setError('Task Description is required.'); return }

    setSaving(true)
    setError(null)
    const db = createClient() as any

    const actingRoleToSave = actingRole && actingRole !== (staffRole ?? null) ? actingRole : null

    const payload =
      mode === 'times'
        ? {
            start_time:    startTime,
            end_time:      endTime,
            break_minutes: breakMins,
            total_hours:   totalHoursFromTimes,
          }
        : {
            start_time:    null,
            end_time:      null,
            break_minutes: 0,
            total_hours:   totalHoursFromInput,
          }

    const { error: dbErr } = await db
      .from('field_time_logs')
      .upsert({
        entry_id:     entryId,
        staff_id:     staffId,
        work_date:    workDate,
        ...payload,
        is_overtime:  isOvertime,
        notes:        notes.trim(),
        acting_role:  actingRoleToSave,
        updated_at:   new Date().toISOString(),
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
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center bg-[#F5F4F1]">
        <CheckCircle2 className="h-14 w-14 text-[#1F7A3F] mb-4" />
        <p className="text-lg font-bold text-[#111111]">Time Logged</p>
        {isOvertime && (
          <p className="text-sm text-[#A86B0C] mt-1 font-medium">Overtime recorded — your manager has been notified.</p>
        )}
        <p className="text-sm text-[#6B6B6F] mt-1">Returning to job hub…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F4F1]">
      <div className="px-5 py-5 space-y-5">

        {/* Mode toggle */}
        <div>
          <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-2">Log As</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('times')}
              className={`py-2.5 rounded-lg text-[13px] font-bold border transition-colors ${
                mode === 'times'
                  ? 'bg-[#111111] text-[#F39200] border-[#111111]'
                  : 'bg-white text-[#6B6B6F] border-[#E8E6E0]'
              }`}
            >
              Start &amp; End Times
            </button>
            <button
              type="button"
              onClick={() => setMode('hours')}
              className={`py-2.5 rounded-lg text-[13px] font-bold border transition-colors ${
                mode === 'hours'
                  ? 'bg-[#111111] text-[#F39200] border-[#111111]'
                  : 'bg-white text-[#6B6B6F] border-[#E8E6E0]'
              }`}
            >
              Hours Onsite
            </button>
          </div>
        </div>

        {mode === 'times' ? (
          <>
            <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase">Shift Hours</p>

            {/* Start + End times */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-[#E8E6E0] rounded-xl p-3.5">
                <label className="block text-[10px] font-bold text-[#6B6B6F] tracking-[0.12em] mb-2">START</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-transparent text-2xl font-bold text-[#111111] focus:outline-none"
                />
              </div>
              <div className="bg-white border-2 border-[#F39200] rounded-xl p-3.5">
                <label className="block text-[10px] font-bold text-[#F39200] tracking-[0.12em] mb-2">END</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-transparent text-2xl font-bold text-[#111111] focus:outline-none"
                />
              </div>
            </div>

            {/* Break */}
            <div>
              <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-2.5">Break</p>
              <div className="flex items-center gap-2">
                {[0, 15, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setBreakMins(mins)}
                    className={`flex-1 py-2.5 rounded-lg text-[13px] font-bold border transition-colors ${
                      breakMins === mins
                        ? 'bg-[#111111] text-[#F39200] border-[#111111]'
                        : 'bg-white text-[#6B6B6F] border-[#E8E6E0]'
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
                  className="w-24 border border-[#E8E6E0] bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F39200]"
                />
                <span className="text-sm text-[#6B6B6F]">minutes (custom)</span>
              </div>
            </div>
          </>
        ) : (
          <div>
            <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-2">Hours Onsite</p>
            <div className="bg-white border-2 border-[#F39200] rounded-xl p-4 flex items-baseline gap-2">
              <input
                type="number"
                min="0"
                step="0.25"
                inputMode="decimal"
                value={hoursInput}
                onChange={e => setHoursInput(e.target.value)}
                placeholder="0.00"
                className="w-28 bg-transparent text-3xl font-bold text-[#111111] focus:outline-none"
              />
              <span className="text-base font-bold text-[#6B6B6F]">hours</span>
            </div>
            <p className="text-xs text-[#9A9A9C] mt-1.5">Enter the total hours spent onsite. Use 0.25 increments (e.g. 7.5).</p>
          </div>
        )}

        {/* Total hours summary */}
        {totalHours !== null && (
          <div className={`rounded-xl p-4 flex items-center gap-3.5 ${
            isOvertime ? 'bg-[#FBF1D8] border border-[#F0D890]' : 'bg-[#111111]'
          }`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isOvertime ? 'bg-[#A86B0C]' : 'bg-[#F39200]'
            }`}>
              <Clock className="h-6 w-6 text-[#111111]" />
            </div>
            <div className="flex-1">
              <p className={`text-[20px] font-bold ${isOvertime ? 'text-[#A86B0C]' : 'text-white'}`}>
                {totalHours}h logged
              </p>
              {isOvertime ? (
                <p className="text-[11px] text-[#A86B0C] font-medium">
                  {(totalHours - 8).toFixed(2)}h overtime — requires manager approval
                </p>
              ) : (
                <p className="text-[11px] text-[#BDBDC0]">Standard hours · under overtime threshold</p>
              )}
            </div>
          </div>
        )}

        {/* Acting Role */}
        {roleRates.length > 0 && (
          <div>
            <label className="block text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-2">
              Acting As
            </label>
            <select
              value={actingRole}
              onChange={e => setActingRole(e.target.value)}
              className="w-full bg-white border border-[#E8E6E0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#F39200]"
            >
              {roleRates.map(r => (
                <option key={r.role_key} value={r.role_key}>
                  {r.label}{staffRole === r.role_key ? ' (default)' : ''}
                </option>
              ))}
            </select>
            {staffRole && actingRole && actingRole !== staffRole && (
              <p className="text-xs text-[#A86B0C] mt-1.5">Hours will be billed at this role's rate, not your default.</p>
            )}
          </div>
        )}

        {/* Task Description */}
        <div>
          <label className="block text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-2">
            Task Description <span className="text-[#A31D1D]">*</span>
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe the work carried out today, e.g. 'Set out columns for Stage 2, checked as-built levels'"
            className="w-full border border-[#E8E6E0] bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#F39200] resize-none"
          />
          <p className="text-xs text-[#9A9A9C] mt-1.5">Required. Appears as the Task Description in the timesheet.</p>
        </div>

        {isOvertime && (
          <div className="flex items-start gap-2 p-4 bg-[#FBF1D8] border border-[#F0D890] rounded-xl">
            <AlertTriangle className="h-4 w-4 text-[#A86B0C] mt-0.5 shrink-0" />
            <p className="text-sm text-[#A86B0C]">
              <span className="font-semibold">Overtime requires approval.</span>{' '}
              Submitting this will notify your Project Manager. Please include a note explaining the overtime.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-[#F8E4E4] border border-[#E9B7B7] rounded-xl">
            <AlertTriangle className="h-4 w-4 text-[#A31D1D] shrink-0" />
            <p className="text-sm text-[#A31D1D]">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          className="w-full py-3.5 bg-[#111111] hover:bg-black disabled:bg-[#4B4B4F] disabled:cursor-not-allowed text-white font-semibold rounded-full text-sm transition-colors flex items-center justify-center gap-2"
        >
          {saving
            ? <Loader2 className="h-4 w-4 animate-spin text-[#F39200]" />
            : <CheckIcon />}
          {saving ? 'Saving…' : existing ? 'Update Time Log' : 'Submit Time Log'}
        </button>

        <div className="pb-8" />
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F39200" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
