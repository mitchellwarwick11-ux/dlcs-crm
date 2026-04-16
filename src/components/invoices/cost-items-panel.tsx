'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Receipt } from 'lucide-react'

interface CostItem {
  id: string
  description: string
  amount: number
  has_gst: boolean
  date: string | null
  invoice_item_id: string | null
  invoice_number?: string | null
}

interface Props {
  projectId: string
  initialCosts: CostItem[]
}

const emptyForm = { description: '', amount: '', has_gst: false, date: '' }

export function CostItemsPanel({ projectId, initialCosts }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!form.description.trim()) { setError('Description is required.'); return }
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) { setError('Enter a valid amount.'); return }

    setSaving(true); setError(null)
    const db = createClient() as any
    const { error: err } = await db.from('project_costs').insert({
      project_id:  projectId,
      description: form.description.trim(),
      amount,
      has_gst:     form.has_gst,
      date:        form.date || null,
    })
    setSaving(false)
    if (err) { setError('Failed to add cost: ' + err.message); return }
    setForm(emptyForm)
    setAdding(false)
    startTransition(() => router.refresh())
  }

  async function handleDelete(id: string) {
    setDeleting(id); setError(null)
    const db = createClient() as any
    const { error: err } = await db.from('project_costs').delete().eq('id', id)
    setDeleting(null)
    if (err) { setError('Delete failed: ' + err.message); return }
    startTransition(() => router.refresh())
  }

  const uninvoiced = initialCosts.filter(c => !c.invoice_item_id)
  const invoiced   = initialCosts.filter(c =>  c.invoice_item_id)
  const totalUninvoiced = uninvoiced.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {initialCosts.length === 0 && !adding ? (
        <p className="text-sm text-slate-400 py-2">No cost items recorded yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left font-medium text-slate-500 pb-2 pr-4">Description</th>
              <th className="text-left font-medium text-slate-500 pb-2 pr-4">Date</th>
              <th className="text-center font-medium text-slate-500 pb-2 pr-4">GST</th>
              <th className="text-right font-medium text-slate-500 pb-2 pr-4">Amount</th>
              <th className="text-left font-medium text-slate-500 pb-2">Invoice</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {initialCosts.map(c => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-4 text-slate-800">{c.description}</td>
                <td className="py-2.5 pr-4 text-slate-500 text-xs whitespace-nowrap">
                  {c.date ? formatDate(c.date) : <span className="text-slate-300">—</span>}
                </td>
                <td className="py-2.5 pr-4 text-center">
                  {c.has_gst
                    ? <span className="text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">GST</span>
                    : <span className="text-xs text-slate-400">N/A</span>}
                </td>
                <td className="py-2.5 pr-4 text-right font-medium text-slate-900 tabular-nums">
                  {formatCurrency(c.amount)}
                </td>
                <td className="py-2.5 pr-2">
                  {c.invoice_item_id ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      <Receipt className="h-3 w-3" />
                      {c.invoice_number ?? 'Invoiced'}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Uninvoiced</span>
                  )}
                </td>
                <td className="py-2.5 text-right">
                  {!c.invoice_item_id && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting === c.id}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                      title="Delete cost item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {uninvoiced.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200">
                <td colSpan={3} className="pt-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Uninvoiced Total
                </td>
                <td className="pt-2.5 text-right font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(totalUninvoiced)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {/* Add form */}
      {adding ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Add Cost Item</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Description <span className="text-red-500">*</span></Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Council lodgement fee"
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount <span className="text-red-500">*</span></Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="h-8 text-sm pl-5"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={form.has_gst}
              onChange={e => setForm(f => ({ ...f, has_gst: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">GST applies to this cost</span>
            <span className="text-xs text-slate-400">(leave unchecked for govt fees, most disbursements)</span>
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? 'Saving…' : 'Add Cost'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setForm(emptyForm); setError(null) }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Cost Item
        </button>
      )}
    </div>
  )
}
