'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2 } from 'lucide-react'

interface Props {
  currentYear:      number
  jobLastSequence:  number | null  // null = no jobs created yet this year
  quoteLastSequence: number
}

export function NumberSequencesManager({ currentYear, jobLastSequence, quoteLastSequence }: Props) {
  const router = useRouter()
  const yearPrefix = String(currentYear).slice(-2)  // e.g. "26"

  // Calculate what the NEXT generated number will be
  const nextJobSeq  = (jobLastSequence ?? 0) + 1
  const nextJobStr  = yearPrefix + (nextJobSeq <= 999
    ? String(nextJobSeq).padStart(3, '0')
    : String(nextJobSeq))
  const nextQuoteStr = `Q-${quoteLastSequence + 1}`

  const [jobInput,   setJobInput]   = useState(nextJobStr)
  const [quoteInput, setQuoteInput] = useState(nextQuoteStr)

  const [savingJob,   setSavingJob]   = useState(false)
  const [savingQuote, setSavingQuote] = useState(false)
  const [jobSaved,    setJobSaved]    = useState(false)
  const [quoteSaved,  setQuoteSaved]  = useState(false)
  const [jobError,    setJobError]    = useState<string | null>(null)
  const [quoteError,  setQuoteError]  = useState<string | null>(null)

  async function saveJobNumber() {
    setJobError(null)
    const val   = jobInput.trim()
    const match = val.match(/^(\d{2})(\d+)$/)
    if (!match) {
      setJobError('Format must be YYNNN — example: ' + nextJobStr)
      return
    }
    const yearTwoDigit = parseInt(match[1], 10)
    const seq          = parseInt(match[2], 10)
    if (seq < 1) {
      setJobError('Sequence must be at least 1')
      return
    }
    const targetYear = 2000 + yearTwoDigit

    setSavingJob(true)
    const db = createClient() as any
    const { error } = await db
      .from('job_number_sequences')
      .upsert({ year: targetYear, last_sequence: seq - 1 }, { onConflict: 'year' })
    setSavingJob(false)

    if (error) { setJobError('Failed to save'); return }
    setJobSaved(true)
    setTimeout(() => setJobSaved(false), 2500)
    router.refresh()
  }

  async function saveQuoteNumber() {
    setQuoteError(null)
    const val   = quoteInput.trim()
    const match = val.match(/^Q-(\d+)$/i)
    if (!match) {
      setQuoteError('Format must be Q-5001')
      return
    }
    const seq = parseInt(match[1], 10)
    if (seq < 1) { setQuoteError('Must be at least Q-1'); return }

    setSavingQuote(true)
    const db = createClient() as any
    const { error } = await db
      .from('quote_number_sequences')
      .update({ last_sequence: seq - 1 })
      .eq('id', 1)
    setSavingQuote(false)

    if (error) { setQuoteError('Failed to save'); return }
    setQuoteSaved(true)
    setTimeout(() => setQuoteSaved(false), 2500)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* Job Number */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Next Job Number
        </label>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={jobInput}
            onChange={e => { setJobInput(e.target.value); setJobSaved(false); setJobError(null) }}
            onKeyDown={e => e.key === 'Enter' && saveJobNumber()}
            className="w-40 border border-slate-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={saveJobNumber}
            disabled={savingJob}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {savingJob  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
             : jobSaved ? <Check   className="h-3.5 w-3.5" />
             : null}
            {jobSaved ? 'Saved' : 'Save'}
          </button>
        </div>
        {jobError && <p className="text-xs text-red-600 mt-1.5">{jobError}</p>}
        <p className="text-xs text-slate-400 mt-1.5">
          The next job created in {currentYear} will use this number. Current sequence is at {nextJobStr}.
          You can also enter a different year prefix (e.g. 21500, 24123) to seed past years.
        </p>
      </div>

      {/* Quote Number */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Next Quote Number
        </label>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={quoteInput}
            onChange={e => { setQuoteInput(e.target.value); setQuoteSaved(false); setQuoteError(null) }}
            onKeyDown={e => e.key === 'Enter' && saveQuoteNumber()}
            className="w-40 border border-slate-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={saveQuoteNumber}
            disabled={savingQuote}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {savingQuote  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
             : quoteSaved ? <Check   className="h-3.5 w-3.5" />
             : null}
            {quoteSaved ? 'Saved' : 'Save'}
          </button>
        </div>
        {quoteError && <p className="text-xs text-red-600 mt-1.5">{quoteError}</p>}
        <p className="text-xs text-slate-400 mt-1.5">
          The next quote created will use this number. Current sequence is at {nextQuoteStr}.
        </p>
      </div>
    </div>
  )
}
