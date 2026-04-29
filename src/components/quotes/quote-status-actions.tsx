'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { QuoteStatus } from '@/types/database'

interface QuoteStatusActionsProps {
  quoteId: string
  status: QuoteStatus
  /** Set when the quote already has a linked project — shows "Mark as Accepted" instead of "Accept & Create Job" */
  hasLinkedJob: boolean
  /** The linked project id — used to create tasks on acceptance */
  projectId?: string | null
}

// Simple status transitions (non-acceptance ones)
const SIMPLE_TRANSITIONS: Record<QuoteStatus, { label: string; next: QuoteStatus; variant?: 'default' | 'outline' | 'destructive' }[]> = {
  draft:     [
    { label: 'Mark as Issued',    next: 'issued',    variant: 'default' },
    { label: 'Cancel Quote',      next: 'cancelled', variant: 'outline' },
  ],
  issued:    [
    { label: 'Mark as Declined',  next: 'declined',  variant: 'outline' },
    { label: 'Cancel Quote',      next: 'cancelled', variant: 'outline' },
  ],
  accepted:  [],
  declined:  [{ label: 'Revert to Draft', next: 'draft', variant: 'outline' }],
  cancelled: [{ label: 'Revert to Draft', next: 'draft', variant: 'outline' }],
}

export function QuoteStatusActions({ quoteId, status, hasLinkedJob, projectId }: QuoteStatusActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  async function transition(next: QuoteStatus) {
    setLoading(next)
    setError(null)

    const supabase = createClient()
    const db = supabase as any
    const updates: Record<string, unknown> = { status: next }
    if (next === 'issued')   updates.sent_at     = new Date().toISOString()
    if (next === 'accepted') updates.approved_at = new Date().toISOString()

    const { error: err } = await db.from('quotes').update(updates).eq('id', quoteId)

    if (err) {
      setError('Failed to update status.')
      setLoading(null)
      return
    }

    // When accepting with a linked job: create one project task per quote task.
    // Fee proposals store the breakdown in quotes.selected_quote_tasks (jsonb);
    // legacy/simple quotes store it as quote_items rows. Prefer the former.
    if (next === 'accepted' && projectId) {
      const { data: quote } = await db
        .from('quotes')
        .select('selected_quote_tasks')
        .eq('id', quoteId)
        .single()

      const quoteTasks = Array.isArray(quote?.selected_quote_tasks) ? quote.selected_quote_tasks : []

      let rows: any[] = []
      if (quoteTasks.length > 0) {
        rows = quoteTasks
          .filter((t: any) => (t?.title ?? '').trim().length > 0)
          .map((t: any, idx: number) => ({
            project_id:    projectId,
            quote_id:      quoteId,
            title:         t.title,
            fee_type:      'fixed',
            quoted_amount: t.price ?? 0,
            status:        'not_started',
            sort_order:    idx,
          }))
      } else {
        const { data: lineItems } = await db
          .from('quote_items')
          .select('description, amount')
          .eq('quote_id', quoteId)
          .order('sort_order')
        rows = (lineItems ?? []).map((item: any, idx: number) => ({
          project_id:    projectId,
          quote_id:      quoteId,
          title:         item.description,
          fee_type:      'fixed',
          quoted_amount: item.amount,
          status:        'not_started',
          sort_order:    idx,
        }))
      }

      if (rows.length > 0) {
        await db.from('project_tasks').insert(rows)
      }
    }

    setLoading(null)
    router.refresh()
  }

  const simpleTransitions = SIMPLE_TRANSITIONS[status] ?? []

  // Show "Accept" button(s) only when quote is issued
  const showAccept = status === 'issued'

  if (simpleTransitions.length === 0 && !showAccept) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Accept button — context-aware */}
      {showAccept && hasLinkedJob && (
        <Button
          size="sm"
          disabled={!!loading}
          onClick={() => transition('accepted')}
        >
          {loading === 'accepted' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          Mark as Accepted
        </Button>
      )}
      {showAccept && !hasLinkedJob && (
        <Button
          size="sm"
          disabled={!!loading}
          onClick={() => router.push(`/projects/new?from_quote=${quoteId}`)}
        >
          Accept &amp; Create Job
        </Button>
      )}

      {/* Simple transitions */}
      {simpleTransitions.map(t => (
        <Button
          key={t.next}
          variant={t.variant ?? 'default'}
          size="sm"
          disabled={!!loading}
          onClick={() => transition(t.next)}
        >
          {loading === t.next ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          {t.label}
        </Button>
      ))}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
