'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface Props {
  entryId: string
  staffId: string
  hasBrief: boolean
  acknowledgedAt: string | null
  acknowledgedByName: string | null
}

export function BriefAcknowledgeButton({
  entryId, staffId, hasBrief, acknowledgedAt, acknowledgedByName,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ackAt, setAckAt] = useState<string | null>(acknowledgedAt)
  const [ackBy, setAckBy] = useState<string | null>(acknowledgedByName)

  async function acknowledge() {
    setBusy(true)
    setError(null)
    const db = createClient() as any
    const now = new Date().toISOString()
    const { error: err } = await db
      .from('field_schedule_entries')
      .update({
        brief_acknowledged_at: now,
        brief_acknowledged_by: staffId,
      })
      .eq('id', entryId)
    if (err) {
      setError('Failed to acknowledge. Please try again.')
      setBusy(false)
      return
    }
    setAckAt(now)
    setAckBy('You')
    setBusy(false)
    router.refresh()
  }

  if (ackAt) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 px-3 bg-[#E7F3EC] border border-[#BDE0C8] rounded-xl">
        <CheckCircle2 className="h-4 w-4 text-[#1F7A3F] shrink-0" />
        <span className="text-[12px] font-semibold text-[#1F7A3F]">
          Acknowledged {ackBy ? `by ${ackBy} ` : ''}· {format(parseISO(ackAt), 'd MMM h:mm a')}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-[11px] text-[#A31D1D] text-center">{error}</p>
      )}
      <button
        onClick={acknowledge}
        disabled={busy}
        className="w-full py-3 rounded-full font-semibold text-[13px] flex items-center justify-center gap-2 bg-[#111111] hover:bg-black text-white active:scale-[0.98] transition-colors disabled:opacity-60"
      >
        {busy
          ? <><Loader2 className="h-4 w-4 animate-spin text-[#F39200]" /> Saving…</>
          : hasBrief
            ? <>I've read &amp; understood the brief</>
            : <>Acknowledge — I'll contact the PM if needed</>
        }
      </button>
    </div>
  )
}
