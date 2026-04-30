'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  CheckCircle2, Loader2, Send, AlertTriangle, AlertCircle, X, FilePen,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface RequirementBlocker {
  label: string
}

interface Props {
  entryId:        string
  staffId:        string
  blockers:       RequirementBlocker[]
  savedAt:        string | null
  didNotAttend:   boolean
  dnaReason:      string | null
}

export function SaveExitButton({
  entryId, staffId, blockers, savedAt, didNotAttend, dnaReason,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDna, setShowDna] = useState(false)
  const [reasonInput, setReasonInput] = useState(dnaReason ?? '')

  const blocked = blockers.length > 0
  const isSaved = !!savedAt

  async function save(asDna: boolean, reason: string | null = null) {
    setBusy(true)
    setError(null)
    const db = createClient() as any
    const now = new Date().toISOString()

    const { error: err } = await db.from('field_staff_visit_status').upsert(
      {
        entry_id:        entryId,
        staff_id:        staffId,
        saved_at:        now,
        did_not_attend:  asDna,
        dna_reason:      asDna ? (reason ?? '').trim() || null : null,
        updated_at:      now,
      },
      { onConflict: 'entry_id,staff_id' }
    )

    if (err) {
      setError('Failed to save. Please try again.')
      setBusy(false)
      return
    }

    setBusy(false)
    setShowDna(false)
    router.push('/field')
  }

  async function handleSaveExit() {
    if (blocked) return
    if (!confirm('Save this job and return to today\'s schedule? You can submit your day at the end.')) return
    await save(false, null)
  }

  async function handleDnaConfirm() {
    if (!reasonInput.trim()) {
      setError('Please enter a reason.')
      return
    }
    await save(true, reasonInput)
  }

  async function handleReopen() {
    if (!confirm('Reopen this job for changes? You can Save & Exit again afterwards.')) return
    setBusy(true)
    setError(null)
    const db = createClient() as any
    const { error: err } = await db
      .from('field_staff_visit_status')
      .update({
        saved_at:        null,
        did_not_attend:  false,
        dna_reason:      null,
        updated_at:      new Date().toISOString(),
      })
      .eq('entry_id', entryId)
      .eq('staff_id', staffId)
    if (err) {
      setError('Failed to reopen.')
      setBusy(false)
      return
    }
    setBusy(false)
    router.refresh()
  }

  // ─── State: already saved (with or without DNA) ───────────────────────────
  if (isSaved) {
    return (
      <div className="space-y-2">
        <div
          className={`flex items-start gap-2 py-3 px-3 rounded-xl border ${
            didNotAttend
              ? 'bg-[#FBF1D8] border-[#F0D890]'
              : 'bg-[#E7F3EC] border-[#BDE0C8]'
          }`}
        >
          <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${didNotAttend ? 'text-[#A86B0C]' : 'text-[#1F7A3F]'}`} />
          <div className="flex-1">
            <p className={`text-[12px] font-semibold ${didNotAttend ? 'text-[#A86B0C]' : 'text-[#1F7A3F]'}`}>
              {didNotAttend ? 'Marked: did not attend' : 'Saved'} · {format(parseISO(savedAt!), 'd MMM h:mm a')}
            </p>
            {didNotAttend && dnaReason && (
              <p className="text-[11px] text-[#6B6B6F] mt-1 whitespace-pre-wrap">{dnaReason}</p>
            )}
            <p className="text-[11px] text-[#6B6B6F] mt-1">
              Pending end-of-day submission.
            </p>
          </div>
        </div>
        <button
          onClick={handleReopen}
          disabled={busy}
          className="w-full text-[11px] text-[#9A9A9C] hover:text-[#4B4B4F] py-1"
        >
          Need to make changes? Reopen this job →
        </button>
        {error && <p className="text-[11px] text-[#A31D1D] text-center">{error}</p>}
      </div>
    )
  }

  // ─── State: DNA modal open ────────────────────────────────────────────────
  if (showDna) {
    return (
      <div className="bg-white border border-[#E8E6E0] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-[#A86B0C]" />
          <p className="text-sm font-bold text-[#111111]">Couldn&apos;t attend site</p>
          <button
            onClick={() => { setShowDna(false); setError(null) }}
            className="ml-auto p-1 -mr-1 rounded text-[#9A9A9C] hover:text-[#4B4B4F]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[12px] text-[#6B6B6F]">
          Briefly explain why this job couldn&apos;t be done. The PM will see this when reviewing the day.
        </p>
        <textarea
          value={reasonInput}
          onChange={e => setReasonInput(e.target.value)}
          placeholder="e.g. Day ran late after morning job, will reschedule"
          rows={3}
          className="w-full text-[13px] text-[#111111] placeholder:text-[#9A9A9C] bg-[#FAF8F3] border border-[#E8E6E0] rounded-lg px-3 py-2 resize-y"
        />
        {error && <p className="text-[11px] text-[#A31D1D]">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleDnaConfirm}
            disabled={busy}
            className="flex-1 py-2.5 rounded-full bg-[#A86B0C] hover:bg-[#8C5808] text-white text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-colors disabled:opacity-60"
          >
            {busy
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              : <>Confirm</>
            }
          </button>
          <button
            onClick={() => { setShowDna(false); setError(null) }}
            disabled={busy}
            className="flex-1 py-2.5 rounded-full bg-white text-[#4B4B4F] border border-[#CFCDC5] text-[13px] font-semibold active:bg-[#F5F4F1] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ─── State: default ───────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Blockers list */}
      {blocked && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-[#FBF1D8] border border-[#F0D890] rounded-xl">
          <AlertTriangle className="h-4 w-4 text-[#A86B0C] mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[12px] font-semibold text-[#A86B0C]">Complete these items first</p>
            <ul className="text-[11px] text-[#A86B0C] mt-1 space-y-0.5 list-disc pl-4">
              {blockers.map(b => <li key={b.label}>{b.label}</li>)}
            </ul>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-[#F8E4E4] border border-[#E9B7B7] rounded-xl">
          <AlertTriangle className="h-4 w-4 text-[#A31D1D] mt-0.5 shrink-0" />
          <p className="text-[11px] text-[#A31D1D]">{error}</p>
        </div>
      )}

      <button
        onClick={handleSaveExit}
        disabled={blocked || busy}
        className={`w-full py-3.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
          !blocked && !busy
            ? 'bg-[#111111] hover:bg-black text-white active:scale-[0.98]'
            : 'bg-[#EFEDE6] text-[#9A9A9C] cursor-not-allowed'
        }`}
      >
        {busy
          ? <><Loader2 className="h-4 w-4 animate-spin text-[#F39200]" /> Saving…</>
          : <><Send className={`h-4 w-4 ${!blocked ? 'text-[#F39200]' : ''}`} /> Save &amp; Exit Job</>
        }
      </button>

      <button
        onClick={() => setShowDna(true)}
        disabled={busy}
        className="w-full py-2.5 rounded-full bg-white text-[#A86B0C] border border-[#F0D890] text-[12px] font-semibold flex items-center justify-center gap-1.5 active:bg-[#FBF1D8] transition-colors"
      >
        <FilePen className="h-3.5 w-3.5" />
        Couldn&apos;t attend site
      </button>
    </div>
  )
}
