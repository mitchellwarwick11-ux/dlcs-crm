'use client'

import { useState, useTransition, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Check, X, MessageSquare, CheckCircle2, Loader2, Send, AlertTriangle } from 'lucide-react'

interface ChecklistItem {
  id: string
  text: string
}

export interface ChecklistResponse {
  item_id: string
  answer: 'yes' | 'no' | null
  comment: string
}

interface Props {
  entryId: string
  staffId: string
  templateId: string
  title: string
  items: ChecklistItem[]
  initialResponses: ChecklistResponse[]
  initiallySubmittedAt: string | null
}

function emptyResponses(items: ChecklistItem[]): ChecklistResponse[] {
  return items.map(i => ({ item_id: i.id, answer: null, comment: '' }))
}

function mergeWithItems(items: ChecklistItem[], saved: ChecklistResponse[]): ChecklistResponse[] {
  const byId = new Map<string, ChecklistResponse>()
  for (const r of saved) byId.set(r.item_id, r)
  return items.map(i => byId.get(i.id) ?? { item_id: i.id, answer: null, comment: '' })
}

export function InteractiveChecklist({
  entryId,
  staffId,
  templateId,
  title,
  items,
  initialResponses,
  initiallySubmittedAt,
}: Props) {
  const router = useRouter()
  const [responses, setResponses] = useState<ChecklistResponse[]>(
    () => mergeWithItems(items, initialResponses)
  )
  const [submittedAt, setSubmittedAt] = useState<string | null>(initiallySubmittedAt)
  const [openComments, setOpenComments] = useState<Set<string>>(() => {
    // Pre-expand any item that already has a comment
    const ids = initialResponses.filter(r => r.comment?.trim()).map(r => r.item_id)
    return new Set(ids)
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const db = createClient() as any

  const answeredCount = useMemo(
    () => responses.filter(r => r.answer === 'yes' || r.answer === 'no').length,
    [responses]
  )
  const allAnswered = answeredCount === items.length
  const isSubmitted = !!submittedAt

  function persist(next: ChecklistResponse[]) {
    setResponses(next)
    if (isSubmitted) return // don't auto-save after submission; user must Re-submit
    startTransition(async () => {
      await db.from('checklist_submissions').upsert(
        {
          entry_id: entryId,
          staff_id: staffId,
          template_id: templateId,
          responses: next,
          checked_items: next.filter(r => r.answer === 'yes').map(r => r.item_id),
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'entry_id,staff_id,template_id' }
      )
    })
  }

  function setAnswer(itemId: string, answer: 'yes' | 'no') {
    if (isSubmitted) return
    persist(responses.map(r => r.item_id === itemId ? { ...r, answer } : r))
  }

  function setComment(itemId: string, comment: string) {
    if (isSubmitted) return
    setResponses(prev => prev.map(r => r.item_id === itemId ? { ...r, comment } : r))
  }

  function commitComment(itemId: string) {
    if (isSubmitted) return
    persist(responses)
  }

  function toggleComment(itemId: string) {
    setOpenComments(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  async function handleSubmit() {
    if (!allAnswered) return
    if (!confirm('Submit checklist? A PDF will be generated and saved to the project documents.')) return
    setSubmitting(true)
    setSubmitError(null)

    const now = new Date().toISOString()

    // 1. Save final responses + mark submitted_at
    const { error: saveErr } = await db.from('checklist_submissions').upsert(
      {
        entry_id: entryId,
        staff_id: staffId,
        template_id: templateId,
        responses,
        checked_items: responses.filter(r => r.answer === 'yes').map(r => r.item_id),
        completed_at: now,
        submitted_at: now,
      },
      { onConflict: 'entry_id,staff_id,template_id' }
    )

    if (saveErr) {
      setSubmitError('Failed to save responses. Please try again.')
      setSubmitting(false)
      return
    }

    // 2. Generate PDF + upload to project documents
    try {
      const res = await fetch(`/api/checklist/${entryId}/${templateId}/pdf`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSubmitError(body?.error || 'Failed to generate PDF.')
        setSubmitting(false)
        return
      }
    } catch {
      setSubmitError('Failed to generate PDF.')
      setSubmitting(false)
      return
    }

    setSubmittedAt(now)
    setSubmitting(false)
    router.refresh()
  }

  function handleEdit() {
    if (!confirm('Edit responses? You\'ll need to re-submit to regenerate the PDF.')) return
    setSubmittedAt(null)
  }

  return (
    <div className="bg-white border border-[#D6D2C7] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-[#FAF8F3] border-b border-[#EFEDE6]">
        <div className="w-[3px] h-3.5 bg-[#F39200]" />
        <p className="text-[13px] font-bold text-[#111111] flex-1">{title}</p>
        <p className="text-[11px] font-bold text-[#6B6B6F]">{answeredCount} / {items.length}</p>
      </div>

      <div>
        {items.map((item, idx) => {
          const r = responses.find(x => x.item_id === item.id) ?? { item_id: item.id, answer: null, comment: '' }
          const commentOpen = openComments.has(item.id)
          const hasComment = !!r.comment?.trim()
          return (
            <div
              key={item.id}
              className={`px-4 py-3 ${idx > 0 ? 'border-t border-[#EFEDE6]' : ''}`}
            >
              <p className="text-[13px] text-[#111111] mb-2 leading-snug">{item.text}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitted}
                  onClick={() => setAnswer(item.id, 'yes')}
                  className={`flex-1 h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
                    r.answer === 'yes'
                      ? 'bg-[#1F7A3F] text-white border-[#1F7A3F]'
                      : 'bg-white text-[#4B4B4F] border-[#CFCDC5] active:bg-[#E8E5DC]'
                  } ${isSubmitted ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={r.answer === 'yes' ? 3 : 2} />
                  Yes
                </button>
                <button
                  type="button"
                  disabled={isSubmitted}
                  onClick={() => setAnswer(item.id, 'no')}
                  className={`flex-1 h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
                    r.answer === 'no'
                      ? 'bg-[#A31D1D] text-white border-[#A31D1D]'
                      : 'bg-white text-[#4B4B4F] border-[#CFCDC5] active:bg-[#E8E5DC]'
                  } ${isSubmitted ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={r.answer === 'no' ? 3 : 2} />
                  No
                </button>
                <button
                  type="button"
                  onClick={() => toggleComment(item.id)}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors border ${
                    commentOpen || hasComment
                      ? 'bg-[#F39200] text-white border-[#F39200]'
                      : 'bg-white text-[#6B6B6F] border-[#CFCDC5] active:bg-[#E8E5DC]'
                  }`}
                  title={hasComment ? 'Comment added' : 'Add comment'}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
              </div>
              {commentOpen && (
                <textarea
                  value={r.comment}
                  onChange={e => setComment(item.id, e.target.value)}
                  onBlur={() => commitComment(item.id)}
                  disabled={isSubmitted}
                  placeholder="Add a commentâ€¦"
                  rows={2}
                  className="mt-2 w-full text-[13px] text-[#111111] placeholder:text-[#9A9A9C] bg-[#FAF8F3] border border-[#D6D2C7] rounded-lg px-3 py-2 resize-y disabled:opacity-60"
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="px-4 py-3 border-t border-[#EFEDE6] bg-[#FAF8F3]">
        {isSubmitted ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#E7F3EC] border border-[#BDE0C8] rounded-xl">
              <CheckCircle2 className="h-4 w-4 text-[#1F7A3F]" />
              <span className="text-[12px] font-semibold text-[#1F7A3F]">
                Submitted â€” saved to project documents
              </span>
            </div>
            <button
              onClick={handleEdit}
              className="w-full text-[11px] text-[#9A9A9C] hover:text-[#4B4B4F] py-1"
            >
              Need to edit? Reopen for changes â†’
            </button>
          </div>
        ) : (
          <>
            {submitError && (
              <div className="flex items-start gap-2 px-3 py-2 mb-2 bg-[#F8E4E4] border border-[#E9B7B7] rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5 text-[#A31D1D] mt-0.5 shrink-0" />
                <p className="text-[11px] text-[#A31D1D]">{submitError}</p>
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className={`w-full py-2.5 rounded-full text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors ${
                allAnswered && !submitting
                  ? 'bg-[#111111] hover:bg-black text-white active:scale-[0.98]'
                  : 'bg-[#EFEDE6] text-[#9A9A9C] cursor-not-allowed'
              }`}
            >
              {submitting
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-[#F39200]" /> Submittingâ€¦</>
                : <><Send className={`h-3.5 w-3.5 ${allAnswered ? 'text-[#F39200]' : ''}`} /> Submit Checklist</>
              }
            </button>
            {!allAnswered && (
              <p className="text-[11px] text-[#9A9A9C] text-center mt-1.5">
                Answer all items to submit ({answeredCount} / {items.length} done)
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
