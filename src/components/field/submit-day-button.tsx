'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Send, AlertTriangle } from 'lucide-react'

interface Props {
  date:           string  // YYYY-MM-DD
  totalToday:     number  // total jobs scheduled today (excluding cancelled)
  readyToSubmit:  number  // jobs saved & not yet submitted
  alreadyDone:    number  // jobs already submitted today
}

export function SubmitDayButton({ date, totalToday, readyToSubmit, alreadyDone }: Props) {
  const router = useRouter()
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)

  const remaining = totalToday - readyToSubmit - alreadyDone
  const allReady  = totalToday > 0 && remaining === 0 && readyToSubmit > 0
  const allDone   = totalToday > 0 && alreadyDone === totalToday

  async function handleSubmit() {
    if (!allReady) return
    if (!confirm(`Submit ${readyToSubmit} ${readyToSubmit === 1 ? 'job' : 'jobs'} for today? Hours will be posted to your timesheet.`)) return

    setBusy(true)
    setError(null)
    setSummary(null)

    try {
      const res = await fetch('/api/field/submit-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(body?.error ?? 'Failed to submit.')
        setBusy(false)
        return
      }

      const parts: string[] = []
      if (body.attended > 0) parts.push(`${body.attended} attended`)
      if (body.dna      > 0) parts.push(`${body.dna} did not attend`)
      if (body.failed   > 0) parts.push(`${body.failed} failed`)
      setSummary(parts.length ? parts.join(' · ') : 'Nothing to submit.')

      if (body.failed > 0 && Array.isArray(body.errors) && body.errors.length > 0) {
        setError(body.errors.map((e: any) => e.reason).join('; '))
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
      router.refresh()
    }
  }

  if (totalToday === 0) return null

  if (allDone) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 px-3 bg-[#E7F3EC] border border-[#BDE0C8] rounded-xl">
        <CheckCircle2 className="h-4 w-4 text-[#1F7A3F]" />
        <span className="text-[12px] font-semibold text-[#1F7A3F]">
          All today&apos;s jobs submitted
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-[#6B6B6F]">
        <span>{readyToSubmit + alreadyDone} of {totalToday} jobs ready</span>
        {alreadyDone > 0 && <span className="text-[#1F7A3F]">{alreadyDone} already submitted</span>}
      </div>

      {summary && (
        <div className="flex items-start gap-2 px-3 py-2 bg-[#E7F3EC] border border-[#BDE0C8] rounded-lg">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#1F7A3F] mt-0.5 shrink-0" />
          <p className="text-[11px] text-[#1F7A3F]">{summary}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 bg-[#F8E4E4] border border-[#E9B7B7] rounded-lg">
          <AlertTriangle className="h-3.5 w-3.5 text-[#A31D1D] mt-0.5 shrink-0" />
          <p className="text-[11px] text-[#A31D1D]">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!allReady || busy}
        className={`w-full py-3.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
          allReady && !busy
            ? 'bg-[#111111] hover:bg-black text-white active:scale-[0.98]'
            : 'bg-[#EFEDE6] text-[#9A9A9C] cursor-not-allowed'
        }`}
      >
        {busy
          ? <><Loader2 className="h-4 w-4 animate-spin text-[#F39200]" /> Submitting…</>
          : <><Send className={`h-4 w-4 ${allReady ? 'text-[#F39200]' : ''}`} /> Submit Today&apos;s Work</>
        }
      </button>

      {!allReady && remaining > 0 && (
        <p className="text-[11px] text-[#9A9A9C] text-center">
          {remaining} {remaining === 1 ? 'job' : 'jobs'} still need Save &amp; Exit before you can submit the day.
        </p>
      )}
    </div>
  )
}
