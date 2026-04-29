'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Loader2, X, Check, Pencil } from 'lucide-react'

export interface PurchaseOrder {
  id: string
  po_number: string
  issued_by: string | null
  issued_date: string | null
  amount: number | null
  notes: string | null
  task_ids: string[]
}

export interface PoTaskOption {
  id: string
  title: string
}

interface PurchaseOrdersPanelProps {
  projectId: string
  initialOrders: PurchaseOrder[]
  tasks: PoTaskOption[]
}

const EMPTY_FORM = { po_number: '', issued_by: '', issued_date: '', amount: '', notes: '' }

export function PurchaseOrdersPanel({ projectId, initialOrders, tasks }: PurchaseOrdersPanelProps) {
  const router = useRouter()
  const [orders, setOrders]     = useState<PurchaseOrder[]>(initialOrders)
  const [adding, setAdding]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [formTaskIds, setFormTaskIds] = useState<string[]>([])
  const [error, setError]       = useState<string | null>(null)
  const [editingTasksFor, setEditingTasksFor] = useState<string | null>(null)
  const [editTaskIds, setEditTaskIds]         = useState<string[]>([])
  const [savingTasks, setSavingTasks]         = useState(false)

  const taskTitle = (id: string) => tasks.find(t => t.id === id)?.title ?? '(deleted task)'

  function field(key: keyof typeof EMPTY_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  function toggleFormTask(id: string) {
    setFormTaskIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleEditTask(id: string) {
    setEditTaskIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
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

    if (formTaskIds.length > 0) {
      const { error: linkErr } = await db.from('purchase_order_tasks').insert(
        formTaskIds.map(task_id => ({ purchase_order_id: data.id, task_id }))
      )
      if (linkErr) { setError(linkErr.message); setSaving(false); return }
    }

    setOrders(prev => [{ ...data, task_ids: formTaskIds }, ...prev])
    setForm(EMPTY_FORM)
    setFormTaskIds([])
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

  function startEditTasks(order: PurchaseOrder) {
    setEditingTasksFor(order.id)
    setEditTaskIds(order.task_ids)
  }

  async function saveEditTasks(orderId: string) {
    setSavingTasks(true)
    const db = createClient() as any
    const current = orders.find(o => o.id === orderId)
    if (!current) { setSavingTasks(false); return }

    const toAdd    = editTaskIds.filter(id => !current.task_ids.includes(id))
    const toRemove = current.task_ids.filter(id => !editTaskIds.includes(id))

    if (toRemove.length > 0) {
      await db.from('purchase_order_tasks')
        .delete()
        .eq('purchase_order_id', orderId)
        .in('task_id', toRemove)
    }
    if (toAdd.length > 0) {
      await db.from('purchase_order_tasks').insert(
        toAdd.map(task_id => ({ purchase_order_id: orderId, task_id }))
      )
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, task_ids: editTaskIds } : o))
    setEditingTasksFor(null)
    setEditTaskIds([])
    setSavingTasks(false)
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
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Authorises tasks (optional)</p>
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No tasks on this job yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 bg-white rounded border border-slate-200 p-2 max-h-40 overflow-y-auto">
                {tasks.map(t => (
                  <label key={t.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={formTaskIds.includes(t.id)}
                      onChange={() => toggleFormTask(t.id)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate">{t.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {saving ? 'Saving…' : 'Save PO'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setForm(EMPTY_FORM); setFormTaskIds([]); setError(null) }} disabled={saving}>
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
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Tasks</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Notes</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(o => (
              <Fragment key={o.id}>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-mono font-medium text-slate-900">{o.po_number}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{o.issued_by ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                    {o.issued_date ? formatDate(o.issued_date) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                    {o.amount != null ? formatCurrency(o.amount) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[18rem]">
                        {o.task_ids.length === 0
                          ? <span className="text-slate-300">— project-level —</span>
                          : o.task_ids.map(taskTitle).join(', ')}
                      </span>
                      <button
                        onClick={() => startEditTasks(o)}
                        className="p-0.5 text-slate-300 hover:text-blue-500 transition-colors"
                        title="Edit tasks"
                        disabled={editingTasksFor === o.id}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
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
                {editingTasksFor === o.id && (
                  <tr className="bg-blue-50">
                    <td colSpan={7} className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Authorises tasks</p>
                      {tasks.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No tasks on this job.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 bg-white rounded border border-slate-200 p-2 max-h-40 overflow-y-auto mb-2">
                          {tasks.map(t => (
                            <label key={t.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
                              <input
                                type="checkbox"
                                checked={editTaskIds.includes(t.id)}
                                onChange={() => toggleEditTask(t.id)}
                                className="h-3.5 w-3.5"
                              />
                              <span className="truncate">{t.title}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEditTasks(o.id)} disabled={savingTasks}>
                          {savingTasks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingTasksFor(null); setEditTaskIds([]) }} disabled={savingTasks}>
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          {orders.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={3} className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Total PO Value</td>
                <td className="px-4 py-2.5 text-right font-bold text-slate-900 tabular-nums">{formatCurrency(total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      ) : null}
    </div>
  )
}
