'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Loader2, X, Check } from 'lucide-react'

export interface PurchaseOrder {
  id: string
  po_number: string
  issued_by: string | null
  issued_date: string | null
  amount: number | null
  notes: string | null
}

interface PurchaseOrdersPanelProps {
  projectId: string
  initialOrders: PurchaseOrder[]
}

const EMPTY_FORM = { po_number: '', issued_by: '', issued_date: '', amount: '', notes: '' }

export function PurchaseOrdersPanel({ projectId, initialOrders }: PurchaseOrdersPanelProps) {
  const router = useRouter()
  const [orders, setOrders]     = useState<PurchaseOrder[]>(initialOrders)
  const [adding, setAdding]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [error, setError]       = useState<string | null>(null)

  function field(key: keyof typeof EMPTY_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleAdd() {
    if (!form.po_number.trim()) { setError('PO Number is required.'); return }
    setSaving(true)
    setError(null)
    const db = createClient() as any
    const { data, error: err } = await db.from('purchase_orders').insert({
      project_id:  projectId,
      po_number:   form.po_number.trim(),
      issued_by:   form.issued_by.trim()   || null,
      issued_date: form.issued_date        || null,
      amount:      form.amount ? parseFloat(form.amount) : null,
      notes:       form.notes.trim()       || null,
    }).select().single()

    if (err) { setError(err.message); setSaving(false); return }
    setOrders(prev => [data, ...prev])
    setForm(EMPTY_FORM)
    setAdding(false)
    setSaving(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const db = createClient() as any
    await db.from('purchase_orders').delete().eq('id', id)
    setOrders(prev => prev.filter(o => o.id !== id))
    setDeleting(null)
    router.refresh()
  }

  const total = orders.reduce((s, o) => s + (o.amount ?? 0), 0)

  return (
    <div className="space-y-3">

      {/* Add form */}
      {adding ? (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-800">Add Purchase Order</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">PO Number <span className="text-red-500">*</span></p>
              <Input value={form.po_number} onChange={field('po_number')} placeholder="e.g. PO-1234" className="h-8 text-sm" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Issued By</p>
              <Input value={form.issued_by} onChange={field('issued_by')} placeholder="Client contact name" className="h-8 text-sm" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Date Issued</p>
              <Input type="date" value={form.issued_date} onChange={field('issued_date')} className="h-8 text-sm" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Approved Amount ($)</p>
              <Input type="number" step="0.01" value={form.amount} onChange={field('amount')} placeholder="0.00" className="h-8 text-sm" />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Notes</p>
            <Input value={form.notes} onChange={field('notes')} placeholder="Optional notes" className="h-8 text-sm" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {saving ? 'Saving…' : 'Save PO'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setForm(EMPTY_FORM); setError(null) }} disabled={saving}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add PO
          </Button>
        </div>
      )}

      {/* Table */}
      {orders.length === 0 && !adding ? (
        <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
          No purchase orders recorded for this job.
        </div>
      ) : orders.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">PO Number</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Issued By</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Notes</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 font-mono font-medium text-slate-900">{o.po_number}</td>
                <td className="px-4 py-2.5 text-slate-600 text-xs">{o.issued_by ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                  {o.issued_date ? formatDate(o.issued_date) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                  {o.amount != null ? formatCurrency(o.amount) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{o.notes ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => handleDelete(o.id)}
                    disabled={deleting === o.id}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Delete PO"
                  >
                    {deleting === o.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {orders.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={3} className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Total PO Value</td>
                <td className="px-4 py-2.5 text-right font-bold text-slate-900 tabular-nums">{formatCurrency(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      ) : null}
    </div>
  )
}
