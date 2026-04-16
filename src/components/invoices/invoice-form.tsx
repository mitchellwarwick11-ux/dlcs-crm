'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { formatCurrency, formatDate, formatHours } from '@/lib/utils/formatters'

interface Task {
  id: string
  title: string
  fee_type: 'fixed' | 'hourly'
  quoted_amount: number | null
  claimed_amount: number
  status: string
}

interface TimeEntry {
  id: string
  task_id: string | null
  date: string
  hours: number
  rate_at_time: number
  description: string | null
  staff_profiles: { full_name: string } | null
}

interface CostItem {
  id: string
  description: string
  amount: number
  has_gst: boolean
  date: string | null
}

interface Props {
  jobNumber: string
  projectId: string
  quoteId: string | null
  tasks: Task[]
  timeEntries: TimeEntry[]
  costs: CostItem[]
  prefill: { contactName: string; contactEmail: string }
}

export function InvoiceForm({ jobNumber, projectId, quoteId, tasks, timeEntries, costs, prefill }: Props) {
  const router = useRouter()

  const defaultDue = new Date()
  defaultDue.setDate(defaultDue.getDate() + 14)

  const [contactName, setContactName]   = useState(prefill.contactName)
  const [contactEmail, setContactEmail] = useState(prefill.contactEmail)
  const [dueDate, setDueDate]           = useState(defaultDue.toISOString().split('T')[0])
  const [notes, setNotes]               = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [selectedCostIds, setSelectedCostIds] = useState<Set<string>>(new Set())
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Fixed fee: "this claim" amount per task — pre-fill from WIP (uninvoiced time value),
  // capped at whatever is still remaining on the quoted amount.
  const [fixedClaims, setFixedClaims] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const t of tasks) {
      if (t.fee_type === 'fixed') {
        const remaining = (t.quoted_amount ?? 0) - (t.claimed_amount ?? 0)
        const wip = timeEntries
          .filter(e => e.task_id === t.id)
          .reduce((s, e) => s + e.hours * e.rate_at_time, 0)
        const prefill = remaining > 0 ? Math.min(wip, remaining) : 0
        m[t.id] = prefill > 0 ? prefill.toFixed(2) : '0'
      }
    }
    return m
  })

  // Hourly: per-entry { checked, description }
  const [entryStates, setEntryStates] = useState<Record<string, { checked: boolean; description: string }>>(() => {
    const m: Record<string, { checked: boolean; description: string }> = {}
    for (const e of timeEntries) {
      m[e.id] = { checked: true, description: e.description ?? '' }
    }
    return m
  })

  const entriesByTask = useMemo(() => {
    const m: Record<string, TimeEntry[]> = {}
    for (const e of timeEntries) {
      if (!e.task_id) continue
      if (!m[e.task_id]) m[e.task_id] = []
      m[e.task_id].push(e)
    }
    return m
  }, [timeEntries])

  const totals = useMemo(() => {
    // Service items — professional services always attract 10% GST
    let serviceSubtotal = 0
    for (const taskId of selectedTaskIds) {
      const task = tasks.find(t => t.id === taskId)
      if (!task) continue
      if (task.fee_type === 'fixed') {
        serviceSubtotal += parseFloat(fixedClaims[taskId] ?? '0') || 0
      } else {
        for (const e of entriesByTask[taskId] ?? []) {
          if (entryStates[e.id]?.checked) serviceSubtotal += e.hours * e.rate_at_time
        }
      }
    }
    // Cost items — GST only where has_gst=true
    let costGST = 0, costNoGST = 0
    for (const costId of selectedCostIds) {
      const cost = costs.find(c => c.id === costId)
      if (!cost) continue
      if (cost.has_gst) costGST += cost.amount
      else costNoGST += cost.amount
    }
    const subtotal = serviceSubtotal + costGST + costNoGST
    const gst = Math.round((serviceSubtotal + costGST) * 10) / 100
    return { subtotal, gst, total: subtotal + gst }
  }, [selectedTaskIds, selectedCostIds, fixedClaims, entryStates, tasks, entriesByTask, costs])

  function toggleTask(id: string) {
    setSelectedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleEntry(id: string) {
    setEntryStates(prev => ({ ...prev, [id]: { ...prev[id], checked: !prev[id].checked } }))
  }

  function setEntryDesc(id: string, desc: string) {
    setEntryStates(prev => ({ ...prev, [id]: { ...prev[id], description: desc } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedTaskIds.size === 0 && selectedCostIds.size === 0) { setError('Select at least one task or cost item.'); return }
    if (totals.subtotal <= 0) { setError('Invoice total must be greater than $0.'); return }

    setSaving(true)
    setError(null)

    const supabase = createClient()
    const db = supabase as any
    const { data: { user } } = await (supabase as any).auth.getUser()

    const { data: invNum, error: numErr } = await db.rpc('generate_invoice_number')
    if (numErr || !invNum) { setError('Failed to generate invoice number.'); setSaving(false); return }

    const { data: newInvoice, error: invErr } = await db
      .from('invoices')
      .insert({
        invoice_number: invNum,
        status: 'draft',
        project_id: projectId,
        quote_id: quoteId,
        subtotal: totals.subtotal,
        gst_amount: totals.gst,
        total: totals.total,
        due_date: dueDate || null,
        notes: notes || null,
        created_by: user?.id ?? null,
      })
      .select('id')
      .single()

    if (invErr || !newInvoice) { setError('Failed to save invoice.'); setSaving(false); return }

    const invoiceId = newInvoice.id
    let sortOrder = 0

    for (const taskId of selectedTaskIds) {
      const task = tasks.find(t => t.id === taskId)
      if (!task) continue

      if (task.fee_type === 'fixed') {
        const claimAmount = parseFloat(fixedClaims[taskId] ?? '0') || 0
        if (claimAmount <= 0) continue

        await db.from('invoice_items').insert({
          invoice_id: invoiceId,
          task_id: taskId,
          description: task.title,
          quantity: 1,
          unit_price: claimAmount,
          prev_claimed_amount: task.claimed_amount ?? 0,
          sort_order: sortOrder++,
        })

        await db.from('project_tasks')
          .update({ claimed_amount: (task.claimed_amount ?? 0) + claimAmount })
          .eq('id', taskId)

      } else {
        // Hourly: one item per checked time entry
        for (const entry of entriesByTask[taskId] ?? []) {
          const state = entryStates[entry.id]
          if (!state?.checked) continue

          const { data: invItem } = await db
            .from('invoice_items')
            .insert({
              invoice_id: invoiceId,
              task_id: taskId,
              time_entry_id: entry.id,
              description: state.description || entry.description || '',
              quantity: entry.hours,
              unit_price: entry.rate_at_time,
              sort_order: sortOrder++,
            })
            .select('id')
            .single()

          if (invItem) {
            await db.from('time_entries')
              .update({ invoice_item_id: invItem.id })
              .eq('id', entry.id)
          }
        }
      }
    }

    // Cost items
    for (const costId of selectedCostIds) {
      const cost = costs.find(c => c.id === costId)
      if (!cost) continue
      const { data: costItem } = await db
        .from('invoice_items')
        .insert({
          invoice_id:  invoiceId,
          description: cost.description,
          quantity:    1,
          unit_price:  cost.amount,
          has_gst:     cost.has_gst,
          sort_order:  sortOrder++,
        })
        .select('id')
        .single()
      if (costItem) {
        await db.from('project_costs')
          .update({ invoice_item_id: costItem.id })
          .eq('id', costId)
      }
    }

    // Generate and store PDF (non-blocking)
    try {
      await fetch(`/api/invoices/${invoiceId}/pdf`, { method: 'POST' })
    } catch { /* PDF failure shouldn't block */ }

    router.push(`/projects/${jobNumber}/invoices/${invoiceId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="p-8 max-w-4xl space-y-6">

      {/* Bill To */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Bill To</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
            <input
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Tasks</h2>

        {tasks.length === 0 && (
          <div className="text-center py-10 bg-white rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">No tasks on this job. Add tasks first.</p>
          </div>
        )}

        {tasks.map(task => {
          const selected      = selectedTaskIds.has(task.id)
          const taskEntries   = entriesByTask[task.id] ?? []
          const remaining     = (task.quoted_amount ?? 0) - (task.claimed_amount ?? 0)
          const thisClaim     = parseFloat(fixedClaims[task.id] ?? '0') || 0
          const taskHourlyVal = taskEntries.reduce((s, e) =>
            s + (entryStates[e.id]?.checked ? e.hours * e.rate_at_time : 0), 0)

          return (
            <div
              key={task.id}
              className={`bg-white rounded-lg border transition-colors ${selected ? 'border-blue-300 shadow-sm' : 'border-slate-200'}`}
            >
              {/* Header row — click to toggle */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer select-none"
                onClick={() => toggleTask(task.id)}
              >
                {/* Checkbox */}
                <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                  {selected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900">{task.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {task.fee_type === 'fixed' ? 'Fixed Fee' : 'Hourly Rate'}
                    {task.fee_type === 'fixed' && task.quoted_amount != null
                      ? ` · Quoted ${formatCurrency(task.quoted_amount)}`
                      : ''}
                    {task.fee_type === 'hourly' && taskEntries.length > 0
                      ? ` · ${taskEntries.length} uninvoiced entr${taskEntries.length === 1 ? 'y' : 'ies'}`
                      : ''}
                    {task.fee_type === 'hourly' && taskEntries.length === 0
                      ? ' · No uninvoiced time entries'
                      : ''}
                  </div>
                </div>

                {selected && (
                  <div className="text-sm font-semibold text-slate-900 shrink-0">
                    {task.fee_type === 'fixed'
                      ? formatCurrency(thisClaim)
                      : formatCurrency(taskHourlyVal)}
                  </div>
                )}
              </div>

              {/* Expanded detail */}
              {selected && (
                <div className="border-t border-slate-100 px-4 pb-5 pt-4">

                  {/* Fixed fee breakdown */}
                  {task.fee_type === 'fixed' && (
                    <div className="grid grid-cols-4 gap-6 text-sm">
                      <div>
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Quoted</div>
                        <div className="font-medium text-slate-800">{formatCurrency(task.quoted_amount ?? 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Previously Claimed</div>
                        <div className="font-medium text-slate-800">{formatCurrency(task.claimed_amount ?? 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">This Claim</div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            step="0.01"
                            onClick={e => e.stopPropagation()}
                            className="w-full border border-slate-200 rounded pl-6 pr-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={fixedClaims[task.id] ?? '0'}
                            onChange={e => setFixedClaims(prev => ({ ...prev, [task.id]: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Remaining</div>
                        <div className={`font-medium ${remaining - thisClaim < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          {formatCurrency(Math.max(0, remaining - thisClaim))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hourly: time entries */}
                  {task.fee_type === 'hourly' && taskEntries.length === 0 && (
                    <p className="text-sm text-slate-400 italic">No uninvoiced time entries for this task.</p>
                  )}

                  {task.fee_type === 'hourly' && taskEntries.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b border-slate-100">
                            <th className="pb-2 w-6" />
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">Staff</th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide w-full">Description</th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Hours</th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Rate</th>
                            <th className="pb-2 text-xs font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {taskEntries.map(entry => {
                            const state   = entryStates[entry.id]
                            const checked = state?.checked ?? true
                            return (
                              <tr key={entry.id} className={!checked ? 'opacity-40' : ''}>
                                <td className="py-2 pr-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleEntry(entry.id)}
                                    className="mt-0.5"
                                    aria-label={checked ? 'Uncheck' : 'Check'}
                                  >
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                      {checked && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </div>
                                  </button>
                                </td>
                                <td className="py-2 pr-4 text-slate-600 whitespace-nowrap text-xs">{formatDate(entry.date)}</td>
                                <td className="py-2 pr-4 text-slate-600 whitespace-nowrap text-xs">{entry.staff_profiles?.full_name ?? '—'}</td>
                                <td className="py-2 pr-4">
                                  <textarea
                                    rows={1}
                                    disabled={!checked}
                                    className="w-full min-w-[180px] border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:bg-slate-50"
                                    value={state?.description ?? ''}
                                    onChange={e => setEntryDesc(entry.id, e.target.value)}
                                  />
                                </td>
                                <td className="py-2 pr-4 text-right tabular-nums text-xs text-slate-700 whitespace-nowrap">{formatHours(entry.hours)}</td>
                                <td className="py-2 pr-4 text-right tabular-nums text-xs text-slate-500 whitespace-nowrap">{formatCurrency(entry.rate_at_time)}/h</td>
                                <td className="py-2 text-right tabular-nums text-sm font-medium text-slate-900 whitespace-nowrap">{formatCurrency(entry.hours * entry.rate_at_time)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Costs */}
      {costs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Costs / Disbursements</h2>
          {costs.map(cost => {
            const selected = selectedCostIds.has(cost.id)
            return (
              <div
                key={cost.id}
                onClick={() => setSelectedCostIds(prev => {
                  const next = new Set(prev)
                  next.has(cost.id) ? next.delete(cost.id) : next.add(cost.id)
                  return next
                })}
                className={`bg-white rounded-lg border transition-colors cursor-pointer select-none flex items-center gap-3 p-4 ${selected ? 'border-blue-300 shadow-sm' : 'border-slate-200'}`}
              >
                <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                  {selected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900">{cost.description}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {cost.has_gst ? 'GST applies' : 'GST N/A'}
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900 shrink-0">
                  {formatCurrency(cost.amount)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <label className="block text-xs font-medium text-slate-600 mb-2">Notes (optional)</label>
        <textarea
          rows={3}
          className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {/* Totals + actions */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="space-y-1.5 text-sm mb-6 max-w-xs ml-auto">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal (ex GST)</span>
            <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>GST (10%)</span>
            <span className="tabular-nums">{formatCurrency(totals.gst)}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-900 text-base pt-2 border-t border-slate-200">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(totals.total)}</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              : 'Save Invoice'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </div>

    </form>
  )
}
