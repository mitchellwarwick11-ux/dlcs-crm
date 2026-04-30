'use client'

import { useState, useMemo, useEffect } from 'react'
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
  approval_approved_by?: string | null
  approval_method?: 'email' | 'phone' | null
  approval_date?: string | null
  approval_prepared_by_profile?: { full_name: string } | { full_name: string }[] | null
}

interface TimeEntry {
  id: string
  task_id: string | null
  date: string
  hours: number
  rate_at_time: number
  description: string | null
  is_variation?: boolean
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
  currentStaffId: string | null
  invoiceLayout: 'role_grouped' | 'per_line'
}

export function InvoiceForm({ jobNumber, projectId, quoteId, tasks, timeEntries: initialTimeEntries, costs, prefill, currentStaffId, invoiceLayout }: Props) {
  const router = useRouter()

  const defaultDue = new Date()
  defaultDue.setDate(defaultDue.getDate() + 14)

  const [contactName, setContactName]   = useState(prefill.contactName)
  const [contactEmail, setContactEmail] = useState(prefill.contactEmail)
  const [dueDate, setDueDate]           = useState(defaultDue.toISOString().split('T')[0])
  const [notes, setNotes]               = useState('')
  const [selectedCostIds, setSelectedCostIds] = useState<Set<string>>(new Set())
  // Per-hourly-task rounded total override (role_grouped layout only). Empty string = no override.
  const [taskRoundedTotals, setTaskRoundedTotals] = useState<Record<string, string>>({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Local mutable copy of the incoming time entries
  const timeEntries = initialTimeEntries

  // Fixed fee: "this claim" amount per task — pre-fill from WIP (uninvoiced time value),
  // capped at whatever is still remaining on the quoted amount.
  const [fixedClaims, setFixedClaims] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const t of tasks) {
      if (t.fee_type === 'fixed') m[t.id] = '0'
    }
    return m
  })

  // Per-entry state: `checked` means
  //   - hourly task: include as line item on this invoice
  //   - fixed-fee task: link to this task's fixed-fee invoice_item on save (absorbed),
  //     unless `isVariation` is true — then bill it hourly under that fixed-fee task instead.
  // `description` is the editable description
  // `invoicedHours` is the hours the user chooses to bill (defaults to logged hours)
  const [entryStates, setEntryStates] = useState<Record<string, { checked: boolean; description: string; invoicedHours: string; isVariation: boolean }>>(() => {
    const m: Record<string, { checked: boolean; description: string; invoicedHours: string; isVariation: boolean }> = {}
    for (const e of initialTimeEntries) {
      m[e.id] = { checked: false, description: e.description ?? '', invoicedHours: String(e.hours), isVariation: !!e.is_variation }
    }
    return m
  })


  // Auto-update fixed-fee "This Claim" from selected entries, capped at remaining quote.
  useEffect(() => {
    setFixedClaims(prev => {
      const next = { ...prev }
      for (const t of tasks) {
        if (t.fee_type !== 'fixed') continue
        const taskEntries = initialTimeEntries.filter(e => e.task_id === t.id)
        if (taskEntries.length === 0) continue
        const selectedValue = taskEntries.reduce(
          (s, e) => {
            const st = entryStates[e.id]
            return s + (st?.checked && !st?.isVariation ? e.hours * e.rate_at_time : 0)
          }, 0)
        const remaining = (t.quoted_amount ?? 0) - (t.claimed_amount ?? 0)
        const capped = Math.max(0, Math.min(selectedValue, remaining))
        next[t.id] = capped.toFixed(2)
      }
      return next
    })
  }, [entryStates, tasks, initialTimeEntries])

  const entriesByTask = useMemo(() => {
    const m: Record<string, TimeEntry[]> = {}
    for (const e of timeEntries) {
      if (!e.task_id) continue
      if (!m[e.task_id]) m[e.task_id] = []
      m[e.task_id].push(e)
    }
    return m
  }, [timeEntries])

  // A task is invoiced iff at least one of its time entries is ticked.
  const selectedTaskIds = useMemo(() => {
    const s = new Set<string>()
    for (const t of tasks) {
      if ((entriesByTask[t.id] ?? []).some(e => entryStates[e.id]?.checked)) s.add(t.id)
    }
    return s
  }, [tasks, entriesByTask, entryStates])

  // Clear any rounding override for tasks that are no longer eligible
  // (deselected, no entries ticked, or layout doesn't support overrides).
  useEffect(() => {
    setTaskRoundedTotals(prev => {
      let changed = false
      const next = { ...prev }
      for (const taskId of Object.keys(next)) {
        const task = tasks.find(t => t.id === taskId)
        const eligible =
          invoiceLayout === 'role_grouped' &&
          !!task && task.fee_type === 'hourly' &&
          selectedTaskIds.has(taskId) &&
          (entriesByTask[taskId] ?? []).some(e => entryStates[e.id]?.checked)
        if (!eligible) {
          delete next[taskId]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [invoiceLayout, selectedTaskIds, entryStates, tasks, entriesByTask])

  // Sum of checked entries × rate for an hourly task — the "computed" (un-rounded) total.
  function hourlyComputedFor(taskId: string): number {
    let s = 0
    for (const e of entriesByTask[taskId] ?? []) {
      if (entryStates[e.id]?.checked) s += invoicedHoursFor(e) * e.rate_at_time
    }
    return s
  }

  // Parse the user's rounded-total override for a task, or null if not active.
  // Only available for hourly tasks under role_grouped layout.
  function roundedTotalFor(taskId: string): number | null {
    if (invoiceLayout !== 'role_grouped') return null
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.fee_type !== 'hourly') return null
    const raw = taskRoundedTotals[taskId]
    if (raw === undefined || raw === '') return null
    const n = parseFloat(raw)
    if (isNaN(n) || n < 0) return null
    return n
  }

  const totals = useMemo(() => {
    // Service items — professional services always attract 10% GST
    let serviceSubtotal = 0
    for (const taskId of selectedTaskIds) {
      const task = tasks.find(t => t.id === taskId)
      if (!task) continue
      if (task.fee_type === 'fixed') {
        serviceSubtotal += parseFloat(fixedClaims[taskId] ?? '0') || 0
        // Variation entries on a fixed-fee task bill hourly on top of the fixed claim.
        for (const e of entriesByTask[taskId] ?? []) {
          const st = entryStates[e.id]
          if (st?.checked && st?.isVariation) serviceSubtotal += invoicedHoursFor(e) * e.rate_at_time
        }
      } else {
        const rounded = roundedTotalFor(taskId)
        if (rounded != null) {
          serviceSubtotal += rounded
        } else {
          for (const e of entriesByTask[taskId] ?? []) {
            if (entryStates[e.id]?.checked) serviceSubtotal += invoicedHoursFor(e) * e.rate_at_time
          }
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
  }, [selectedTaskIds, selectedCostIds, fixedClaims, entryStates, tasks, entriesByTask, costs, taskRoundedTotals, invoiceLayout])

  function toggleEntry(id: string) {
    setEntryStates(prev => ({ ...prev, [id]: { ...prev[id], checked: !prev[id].checked } }))
  }

  function setEntriesChecked(entryIds: string[], checked: boolean) {
    setEntryStates(prev => {
      const next = { ...prev }
      for (const id of entryIds) {
        if (next[id]) next[id] = { ...next[id], checked }
      }
      return next
    })
  }

  function setEntryDesc(id: string, desc: string) {
    setEntryStates(prev => ({ ...prev, [id]: { ...prev[id], description: desc } }))
  }

  function toggleEntryVariation(id: string) {
    setEntryStates(prev => ({ ...prev, [id]: { ...prev[id], isVariation: !prev[id].isVariation } }))
  }

  function setEntriesVariation(entryIds: string[], isVariation: boolean) {
    setEntryStates(prev => {
      const next = { ...prev }
      for (const id of entryIds) {
        if (next[id]) next[id] = { ...next[id], isVariation }
      }
      return next
    })
  }

  function setEntryInvoicedHours(id: string, hours: string) {
    setEntryStates(prev => ({ ...prev, [id]: { ...prev[id], invoicedHours: hours } }))
  }

  // Parse the user's invoiced-hours input; fall back to the logged value if blank/invalid.
  function invoicedHoursFor(entry: TimeEntry): number {
    const raw = entryStates[entry.id]?.invoicedHours
    const n = parseFloat(raw ?? '')
    if (isNaN(n) || n < 0) return entry.hours
    return n
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
        const variationEntries = (entriesByTask[taskId] ?? [])
          .filter(e => entryStates[e.id]?.checked && entryStates[e.id]?.isVariation)

        if (claimAmount <= 0 && variationEntries.length === 0) continue

        if (claimAmount > 0) {
          const { data: fixedItem } = await db.from('invoice_items').insert({
            invoice_id: invoiceId,
            task_id: taskId,
            description: task.title,
            quantity: 1,
            unit_price: claimAmount,
            prev_claimed_amount: task.claimed_amount ?? 0,
            sort_order: sortOrder++,
          }).select('id').single()

          // Link only absorbed (non-variation) ticked entries to the fixed-fee invoice_item.
          // Also clear is_variation on these entries — they were marked back to absorbed.
          if (fixedItem) {
            const absorbedIds = (entriesByTask[taskId] ?? [])
              .filter(e => entryStates[e.id]?.checked && !entryStates[e.id]?.isVariation)
              .map(e => e.id)
            if (absorbedIds.length > 0) {
              await db.from('time_entries')
                .update({ invoice_item_id: fixedItem.id, is_variation: false })
                .in('id', absorbedIds)
            }
          }

          await db.from('project_tasks')
            .update({ claimed_amount: (task.claimed_amount ?? 0) + claimAmount })
            .eq('id', taskId)
        }

        // Variation entries — billed hourly under the same fixed-fee task; do NOT touch claimed_amount
        for (const entry of variationEntries) {
          const state = entryStates[entry.id]
          const invHours = invoicedHoursFor(entry)
          const { data: varItem } = await db
            .from('invoice_items')
            .insert({
              invoice_id: invoiceId,
              task_id: taskId,
              time_entry_id: entry.id,
              description: state.description || entry.description || '',
              quantity: invHours,
              unit_price: entry.rate_at_time,
              is_variation: true,
              sort_order: sortOrder++,
            })
            .select('id')
            .single()

          if (varItem) {
            // Persist is_variation back to the time entry so the V badge shows on the Time tab.
            await db.from('time_entries')
              .update({ invoice_item_id: varItem.id, is_variation: true })
              .eq('id', entry.id)
          }
        }

      } else {
        // Hourly: one item per checked time entry
        let computedTotal = 0
        for (const entry of entriesByTask[taskId] ?? []) {
          const state = entryStates[entry.id]
          if (!state?.checked) continue

          const invoicedHours = invoicedHoursFor(entry)
          computedTotal += invoicedHours * entry.rate_at_time
          const { data: invItem } = await db
            .from('invoice_items')
            .insert({
              invoice_id: invoiceId,
              task_id: taskId,
              time_entry_id: entry.id,
              description: state.description || entry.description || '',
              quantity: invoicedHours,
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

        // Rounding adjustment line — only when an override is active and differs.
        const rounded = roundedTotalFor(taskId)
        if (rounded != null && Math.abs(rounded - computedTotal) >= 0.005) {
          const delta = Math.round((rounded - computedTotal) * 100) / 100
          await db.from('invoice_items').insert({
            invoice_id: invoiceId,
            task_id: taskId,
            description: 'Rounding adjustment',
            quantity: 1,
            unit_price: delta,
            sort_order: sortOrder++,
          })
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
              className={`bg-white rounded-lg border transition-colors ${selected ? 'border-blue-400 bg-blue-50/40 shadow-sm' : 'border-slate-200'}`}
            >
              {/* Header row */}
              <div className="flex items-center gap-3 p-4 select-none">
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

                {selected && task.fee_type === 'fixed' && (
                  <div className="text-sm font-semibold text-slate-900 shrink-0">
                    {formatCurrency(thisClaim)}
                  </div>
                )}

                {selected && task.fee_type === 'hourly' && (() => {
                  const canRound = invoiceLayout === 'role_grouped' && taskEntries.some(e => entryStates[e.id]?.checked)
                  if (!canRound) {
                    return (
                      <div className="text-sm font-semibold text-slate-900 shrink-0">
                        {formatCurrency(taskHourlyVal)}
                      </div>
                    )
                  }
                  const overrideRaw = taskRoundedTotals[task.id]
                  const overrideNum = overrideRaw !== undefined && overrideRaw !== '' ? parseFloat(overrideRaw) : NaN
                  const hasOverride = !isNaN(overrideNum) && Math.abs(overrideNum - taskHourlyVal) >= 0.005
                  return (
                    <div className="flex items-center gap-4 shrink-0" onClick={e => e.stopPropagation()}>
                      {/* Original (read-only) */}
                      <div className="flex flex-col items-end">
                        <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Original</div>
                        <div className="text-sm font-semibold text-slate-500 tabular-nums">{formatCurrency(taskHourlyVal)}</div>
                      </div>
                      {/* Invoiced (editable) */}
                      <div className="flex flex-col items-end">
                        <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Invoiced</div>
                        <div className="flex items-center gap-1">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={taskHourlyVal.toFixed(2)}
                              value={overrideRaw ?? ''}
                              onChange={e => setTaskRoundedTotals(prev => ({ ...prev, [task.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur() } }}
                              className={`w-28 border rounded pl-5 pr-2 py-1 text-sm text-right tabular-nums font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${hasOverride ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}
                            />
                          </div>
                          {hasOverride && (
                            <button
                              type="button"
                              onClick={() => setTaskRoundedTotals(prev => {
                                const next = { ...prev }; delete next[task.id]; return next
                              })}
                              className="text-slate-400 hover:text-slate-600 text-base leading-none"
                              title="Reset to original"
                              aria-label="Reset to original"
                            >×</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Detail — always visible so entries are reviewable before selecting */}
              {(taskEntries.length > 0 || task.fee_type === 'fixed') && (
                <div className="border-t border-slate-100 px-4 pb-5 pt-4">

                  {/* Fixed fee breakdown */}
                  {task.fee_type === 'fixed' && (
                    <>
                      {(() => {
                        const prep = Array.isArray(task.approval_prepared_by_profile)
                          ? task.approval_prepared_by_profile[0]
                          : task.approval_prepared_by_profile
                        const hasApproval = prep?.full_name || task.approval_approved_by || task.approval_method || task.approval_date
                        if (!hasApproval) return null
                        const dateStr = task.approval_date
                          ? new Date(task.approval_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                          : null
                        const parts: string[] = []
                        if (prep?.full_name) parts.push(`Prepared by ${prep.full_name}`)
                        if (task.approval_approved_by) parts.push(`approved by ${task.approval_approved_by}`)
                        if (task.approval_method) parts.push(`via ${task.approval_method}${dateStr ? ` ${dateStr}` : ''}`)
                        else if (dateStr) parts.push(dateStr)
                        return (
                          <div className="mb-4 px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600">
                            <span className="font-semibold text-slate-500 uppercase tracking-wide mr-2">Approval</span>
                            {parts.join(' · ')}
                          </div>
                        )
                      })()}
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

                      {/* Underlying time entries — for review (include / carry over / write off) */}
                      {taskEntries.length > 0 && (
                        <div className="mt-5 border-t border-slate-100 pt-4" onClick={e => e.stopPropagation()}>
                          <div className="flex items-baseline justify-between mb-2">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Time Entries</div>
                            <div className="text-xs text-slate-500 flex gap-4">
                              <span>
                                Absorbed: <span className="tabular-nums font-medium text-slate-700">
                                  {formatCurrency(
                                    taskEntries.reduce((s, e) => {
                                      const st = entryStates[e.id]
                                      return s + (st?.checked && !st?.isVariation ? e.hours * e.rate_at_time : 0)
                                    }, 0)
                                  )}
                                </span>
                              </span>
                              <span>
                                Variations: <span className="tabular-nums font-medium text-amber-700">
                                  {formatCurrency(
                                    taskEntries.reduce((s, e) => {
                                      const st = entryStates[e.id]
                                      return s + (st?.checked && st?.isVariation ? invoicedHoursFor(e) * e.rate_at_time : 0)
                                    }, 0)
                                  )}
                                </span>
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-400 mb-2">
                            Ticked entries are absorbed by this claim. Tick <span className="font-medium text-amber-700">Variation</span> to bill an entry at hourly rates as out-of-scope work — it appears below the fixed fee on the invoice and does NOT count toward the claim.
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left border-b border-slate-100">
                                  <th className="pb-2 pr-2 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap text-center">
                                    {(() => {
                                      const allChecked  = taskEntries.length > 0 && taskEntries.every(e => entryStates[e.id]?.checked)
                                      const noneChecked = taskEntries.every(e => !entryStates[e.id]?.checked)
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => setEntriesChecked(taskEntries.map(e => e.id), !allChecked)}
                                          className="inline-flex"
                                          aria-label={allChecked ? 'Unselect all' : 'Select all'}
                                          title={allChecked ? 'Unselect all' : 'Select all'}
                                        >
                                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allChecked ? 'bg-blue-600 border-blue-600' : !noneChecked ? 'bg-blue-100 border-blue-400' : 'border-slate-300'}`}>
                                            {allChecked && (
                                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                                                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                              </svg>
                                            )}
                                            {!allChecked && !noneChecked && (
                                              <div className="w-2 h-0.5 bg-blue-600 rounded" />
                                            )}
                                          </div>
                                        </button>
                                      )
                                    })()}
                                  </th>
                                  <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                                  <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">Staff</th>
                                  <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide w-full">Description</th>
                                  <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Hours</th>
                                  <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Rate</th>
                                  <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Amount</th>
                                  <th className="pb-2 pl-2 text-xs font-medium text-amber-700 uppercase tracking-wide text-center whitespace-nowrap">
                                    {(() => {
                                      const checkedEntries = taskEntries.filter(e => entryStates[e.id]?.checked)
                                      const allVar  = checkedEntries.length > 0 && checkedEntries.every(e => entryStates[e.id]?.isVariation)
                                      const noneVar = checkedEntries.every(e => !entryStates[e.id]?.isVariation)
                                      const disabled = checkedEntries.length === 0
                                      return (
                                        <button
                                          type="button"
                                          disabled={disabled}
                                          onClick={() => setEntriesVariation(checkedEntries.map(e => e.id), !allVar)}
                                          className="inline-flex items-center gap-1 disabled:opacity-30"
                                          title={disabled ? 'Tick entries first' : (allVar ? 'Mark none as variation' : 'Mark all as variation')}
                                        >
                                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allVar ? 'bg-amber-600 border-amber-600' : !noneVar ? 'bg-amber-100 border-amber-400' : 'border-slate-300'}`}>
                                            {allVar && (
                                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                                                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                              </svg>
                                            )}
                                            {!allVar && !noneVar && (
                                              <div className="w-2 h-0.5 bg-amber-600 rounded" />
                                            )}
                                          </div>
                                          <span>Variation</span>
                                        </button>
                                      )
                                    })()}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {taskEntries.map(entry => {
                                  const state     = entryStates[entry.id]
                                  const checked   = state?.checked ?? false
                                  const variation = state?.isVariation ?? false
                                  const invHours  = invoicedHoursFor(entry)
                                  const amount    = (variation ? invHours : entry.hours) * entry.rate_at_time
                                  return (
                                    <tr key={entry.id} className={!checked ? 'opacity-40' : (variation ? 'bg-amber-50/40' : '')}>
                                      <td className="py-2 pr-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => toggleEntry(entry.id)}
                                          className="inline-flex"
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
                                      <td className="py-2 pr-4 text-xs text-slate-700">
                                        {variation && checked ? (
                                          <textarea
                                            rows={1}
                                            className="w-full min-w-[180px] border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none bg-white"
                                            value={state?.description ?? ''}
                                            onChange={e => setEntryDesc(entry.id, e.target.value)}
                                          />
                                        ) : (
                                          entry.description ?? <span className="text-slate-300">—</span>
                                        )}
                                      </td>
                                      <td className="py-2 pr-4 text-right tabular-nums text-xs text-slate-700 whitespace-nowrap">
                                        {variation && checked ? (
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.25"
                                            value={state?.invoicedHours ?? ''}
                                            onChange={e => setEntryInvoicedHours(entry.id, e.target.value)}
                                            className="w-20 border border-amber-300 rounded px-2 py-1 text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                                          />
                                        ) : (
                                          formatHours(entry.hours)
                                        )}
                                      </td>
                                      <td className="py-2 pr-4 text-right tabular-nums text-xs text-slate-500 whitespace-nowrap">{formatCurrency(entry.rate_at_time)}/h</td>
                                      <td className="py-2 pr-4 text-right tabular-nums text-sm font-medium text-slate-900 whitespace-nowrap">{formatCurrency(amount)}</td>
                                      <td className="py-2 pl-2 text-center">
                                        <button
                                          type="button"
                                          disabled={!checked}
                                          onClick={() => toggleEntryVariation(entry.id)}
                                          className="inline-flex disabled:opacity-30 disabled:cursor-not-allowed"
                                          aria-label={variation ? 'Unmark as variation' : 'Mark as variation'}
                                          title={variation ? 'Unmark as variation' : 'Mark as variation (bill hourly under this fixed fee)'}
                                        >
                                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${variation ? 'bg-amber-600 border-amber-600' : 'border-slate-300'}`}>
                                            {variation && (
                                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                                                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                              </svg>
                                            )}
                                          </div>
                                        </button>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
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
                            <th className="pb-2 pr-2 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap text-center">
                              {(() => {
                                const allChecked  = taskEntries.length > 0 && taskEntries.every(e => entryStates[e.id]?.checked)
                                const noneChecked = taskEntries.every(e => !entryStates[e.id]?.checked)
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setEntriesChecked(taskEntries.map(e => e.id), !allChecked)}
                                    className="inline-flex"
                                    aria-label={allChecked ? 'Unselect all' : 'Select all'}
                                    title={allChecked ? 'Unselect all' : 'Select all'}
                                  >
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allChecked ? 'bg-blue-600 border-blue-600' : !noneChecked ? 'bg-blue-100 border-blue-400' : 'border-slate-300'}`}>
                                      {allChecked && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                      {!allChecked && !noneChecked && (
                                        <div className="w-2 h-0.5 bg-blue-600 rounded" />
                                      )}
                                    </div>
                                  </button>
                                )
                              })()}
                            </th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">Staff</th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide w-full">Description</th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Logged</th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Invoiced</th>
                            <th className="pb-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Rate</th>
                            <th className="pb-2 text-xs font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {taskEntries.map(entry => {
                            const state     = entryStates[entry.id]
                            const checked   = state?.checked ?? false
                            const invHours  = invoicedHoursFor(entry)
                            const adjusted  = Math.abs(invHours - entry.hours) > 0.001
                            return (
                              <tr key={entry.id} className={!checked ? 'opacity-40' : ''}>
                                <td className="py-2 pr-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleEntry(entry.id)}
                                    className="inline-flex"
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
                                <td className="py-2 pr-4 text-right tabular-nums text-xs text-slate-500 whitespace-nowrap">{formatHours(entry.hours)}</td>
                                <td className="py-2 pr-4 text-right whitespace-nowrap">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.25"
                                    disabled={!checked}
                                    value={state?.invoicedHours ?? ''}
                                    onChange={e => setEntryInvoicedHours(entry.id, e.target.value)}
                                    className={`w-20 border rounded px-2 py-1 text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 ${adjusted && checked ? 'border-amber-400 bg-amber-50 font-medium' : 'border-slate-200'}`}
                                  />
                                </td>
                                <td className="py-2 pr-4 text-right tabular-nums text-xs text-slate-500 whitespace-nowrap">{formatCurrency(entry.rate_at_time)}/h</td>
                                <td className="py-2 text-right tabular-nums text-sm font-medium text-slate-900 whitespace-nowrap">{formatCurrency(invHours * entry.rate_at_time)}</td>
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
