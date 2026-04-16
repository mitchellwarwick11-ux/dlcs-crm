'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/formatters'
import { Plus, Trash2, Loader2 } from 'lucide-react'

interface LineItem {
  key: string       // local unique key for React
  id?: string       // DB id (only on existing items)
  description: string
  quantity: string
  unit_price: string
}

interface QuoteFormProps {
  projectId: string
  jobNumber: string
  /** Provided when editing an existing quote */
  quote?: {
    id: string
    quote_number: string
    notes: string | null
    valid_until: string | null
    items: {
      id: string
      description: string
      quantity: number
      unit_price: number
      sort_order: number
    }[]
  }
}

function makeKey() {
  return Math.random().toString(36).slice(2)
}

function emptyItem(): LineItem {
  return { key: makeKey(), description: '', quantity: '1', unit_price: '' }
}

export function QuoteForm({ projectId, jobNumber, quote }: QuoteFormProps) {
  const router = useRouter()
  const isEdit = !!quote

  const [notes, setNotes]           = useState(quote?.notes ?? '')
  const [validUntil, setValidUntil] = useState(quote?.valid_until ?? '')
  const [items, setItems]           = useState<LineItem[]>(
    quote?.items.length
      ? quote.items
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(i => ({
            key:        makeKey(),
            id:         i.id,
            description: i.description,
            quantity:   String(i.quantity),
            unit_price: String(i.unit_price),
          }))
      : [emptyItem()]
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // ── Calculated totals ─────────────────────────────────────────────────────
  function lineAmount(item: LineItem): number {
    const qty   = parseFloat(item.quantity)  || 0
    const price = parseFloat(item.unit_price) || 0
    return Math.round(qty * price * 100) / 100
  }

  const subtotal = items.reduce((sum, i) => sum + lineAmount(i), 0)
  const gst      = Math.round(subtotal * 0.1 * 100) / 100
  const total    = Math.round((subtotal + gst) * 100) / 100

  // ── Item helpers ──────────────────────────────────────────────────────────
  const updateItem = useCallback((key: string, field: keyof LineItem, value: string) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i))
  }, [])

  const addItem = () => setItems(prev => [...prev, emptyItem()])

  const removeItem = (key: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.key !== key) : prev)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validItems = items.filter(i => i.description.trim())
    if (validItems.length === 0) {
      setError('Add at least one line item with a description.')
      return
    }

    const invalidPrice = validItems.find(i => isNaN(parseFloat(i.unit_price)) || parseFloat(i.unit_price) < 0)
    if (invalidPrice) {
      setError('All line items need a valid unit price.')
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const db = supabase as any

    if (isEdit) {
      // Update quote record
      const { error: qErr } = await db
        .from('quotes')
        .update({
          notes:      notes.trim() || null,
          valid_until: validUntil || null,
          subtotal,
          gst_amount: gst,
          total,
        })
        .eq('id', quote!.id)

      if (qErr) {
        setError('Failed to update quote. Please try again.')
        setSubmitting(false)
        return
      }

      // Replace all line items
      await db.from('quote_items').delete().eq('quote_id', quote!.id)

      const itemInserts = validItems.map((item, idx) => ({
        quote_id:    quote!.id,
        description: item.description.trim(),
        quantity:    parseFloat(item.quantity)  || 1,
        unit_price:  parseFloat(item.unit_price) || 0,
        sort_order:  idx,
      }))
      const { error: iErr } = await db.from('quote_items').insert(itemInserts)

      if (iErr) {
        setError('Quote saved but line items failed. Please try again.')
        setSubmitting(false)
        return
      }

      router.push(`/projects/${jobNumber}/quotes/${quote!.id}`)
      router.refresh()

    } else {
      // Create — generate quote number
      const { data: existing } = await db
        .from('quotes')
        .select('id')
        .eq('project_id', projectId)

      const seq         = (existing?.length ?? 0) + 1
      const quoteNumber = `Q-${jobNumber}-${seq}`

      const { data: newQuote, error: qErr } = await db
        .from('quotes')
        .insert({
          project_id:  projectId,
          quote_number: quoteNumber,
          status:      'draft',
          notes:       notes.trim() || null,
          valid_until: validUntil || null,
          subtotal,
          gst_amount:  gst,
          total,
        })
        .select()
        .single()

      if (qErr || !newQuote) {
        setError('Failed to create quote. Please try again.')
        setSubmitting(false)
        return
      }

      const itemInserts = validItems.map((item, idx) => ({
        quote_id:    newQuote.id,
        description: item.description.trim(),
        quantity:    parseFloat(item.quantity)  || 1,
        unit_price:  parseFloat(item.unit_price) || 0,
        sort_order:  idx,
      }))
      const { error: iErr } = await db.from('quote_items').insert(itemInserts)

      if (iErr) {
        setError('Quote created but line items failed. Please try again.')
        setSubmitting(false)
        return
      }

      router.push(`/projects/${jobNumber}/quotes/${newQuote.id}`)
      router.refresh()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_80px_120px_100px_36px] gap-2 mb-2 px-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Description</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Qty</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Unit Price</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Amount</p>
            <span />
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.key} className="grid grid-cols-[1fr_80px_120px_100px_36px] gap-2 items-center">
                <Input
                  value={item.description}
                  onChange={e => updateItem(item.key, 'description', e.target.value)}
                  placeholder={`Item ${idx + 1}`}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={e => updateItem(item.key, 'quantity', e.target.value)}
                  className="h-8 text-sm text-right"
                />
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={e => updateItem(item.key, 'unit_price', e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-sm pl-5 text-right"
                  />
                </div>
                <p className="text-sm text-right font-medium text-slate-700 tabular-nums">
                  {lineAmount(item) > 0 ? formatCurrency(lineAmount(item)) : <span className="text-slate-300">—</span>}
                </p>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  disabled={items.length === 1}
                  className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                  title="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="mt-4"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Line
          </Button>

          {/* Totals */}
          <div className="mt-6 border-t border-slate-200 pt-4 space-y-1.5">
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-800 w-28 text-right tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-slate-500">GST (10%)</span>
              <span className="font-medium text-slate-800 w-28 text-right tabular-nums">{formatCurrency(gst)}</span>
            </div>
            <div className="flex justify-end gap-8 text-sm border-t border-slate-200 pt-1.5 mt-1.5">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="font-bold text-slate-900 w-28 text-right tabular-nums text-base">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes & Options */}
      <Card>
        <CardHeader><CardTitle>Notes & Options</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="valid_until">Valid Until</Label>
            <Input
              id="valid_until"
              type="date"
              value={validUntil}
              onChange={e => setValidUntil(e.target.value)}
              className="max-w-[180px]"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Quote valid for 30 days. Prices exclude disbursements unless noted."
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Quote')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
