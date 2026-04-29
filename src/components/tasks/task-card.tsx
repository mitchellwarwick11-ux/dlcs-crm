'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FEE_TYPES } from '@/lib/constants/statuses'
import { formatCurrency } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { Pencil, CalendarPlus, Receipt } from 'lucide-react'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/lib/constants/statuses'
import { TaskStatusDropdown } from './task-status-dropdown'
import type { InvoiceStatus } from '@/types/database'

interface AssignedStaff {
  id: string
  full_name: string
}

interface InvoiceLink {
  id: string
  invoice_number: string
  status: string
  amount: number
}

interface TaskCardProps {
  task: {
    id: string
    title: string
    description: string | null
    status: string
    fee_type: string
    quoted_amount: number | null
    due_date: string | null
    approval_approved_by?: string | null
    approval_method?: 'email' | 'phone' | null
    approval_date?: string | null
    approval_prepared_by_profile?: { full_name: string } | { full_name: string }[] | null
    quote?: {
      quote_number: string
      contact_name: string | null
      approved_at: string | null
      created_by_profile?: { full_name: string } | { full_name: string }[] | null
    } | { quote_number: string; contact_name: string | null; approved_at: string | null; created_by_profile?: { full_name: string } | { full_name: string }[] | null }[] | null
  }
  assignedStaff: AssignedStaff[]
  workDone: number      // sum of hours × rate (from time_entries)
  invoiced: number      // sum of invoice_items (from sent/paid invoices)
  invoices: InvoiceLink[]
  jobNumber: string
  onSchedule?: (taskId: string) => void
}

export function TaskCard({ task, assignedStaff, workDone, invoiced, invoices, jobNumber, onSchedule }: TaskCardProps) {
  const router = useRouter()
  const [status, setStatus] = useState(task.status)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  async function changeStatus(nextStatus: TaskStatus) {
    if (nextStatus === status) return
    const previous = status
    setStatus(nextStatus)
    setUpdatingStatus(true)
    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('project_tasks')
      .update({ status: nextStatus })
      .eq('id', task.id)
    setUpdatingStatus(false)

    if (error) {
      setStatus(previous)
    } else {
      router.refresh()
    }
  }

  const feeLabel = FEE_TYPES[task.fee_type as keyof typeof FEE_TYPES] ?? task.fee_type

  // Financial calculations
  const isFixed = task.fee_type === 'fixed'
  const quoted = task.quoted_amount ?? null
  const uninvoicedWip = isFixed ? Math.max(workDone - invoiced, 0) : workDone
  const remaining = quoted !== null ? quoted - invoiced : null        // fixed row 1: Quoted - Claimed
  const balanceAfterWip = remaining !== null ? remaining - uninvoicedWip : null  // fixed row 2: Remaining - WIP
  const toInvoice = workDone                                          // hourly: WIP not yet invoiced

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 truncate">{task.title}</h3>
          {task.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Status dropdown */}
          <TaskStatusDropdown
            status={status}
            onChange={changeStatus}
            disabled={updatingStatus}
            size="md"
          />

          {/* Schedule field work */}
          {onSchedule && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => onSchedule(task.id)}
              title="Schedule field work"
              aria-label="Schedule field work"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Edit */}
          <Link href={`/projects/${jobNumber}/tasks/${task.id}/edit`}>
            <Button variant="outline" size="icon-sm">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Fee type + due date */}
      <div className="flex items-center gap-3">
        <span className="inline-block text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
          {feeLabel}
        </span>
        {task.due_date && (
          <span className="text-xs text-slate-400">
            Due {new Date(task.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* Financial summary */}
      <div className="space-y-3 pt-1 border-t border-slate-100">
        {isFixed ? (
          <>
            {/* Row 1 — invoicing: Quoted / Claimed / Remaining */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Quoted</p>
                <p className="text-sm font-semibold text-slate-800">
                  {quoted !== null ? formatCurrency(quoted) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Claimed</p>
                <p className="text-sm font-semibold text-slate-800">{formatCurrency(invoiced)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Remaining</p>
                <p className={cn(
                  'text-sm font-semibold',
                  remaining !== null && remaining < 0 ? 'text-red-600' : 'text-slate-800'
                )}>
                  {remaining !== null ? formatCurrency(remaining) : '—'}
                </p>
              </div>
            </div>

            {/* Row 2 — WIP: only when time has been logged */}
            {uninvoicedWip > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dashed border-slate-100">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Work in Progress</p>
                  <p className="text-sm font-semibold text-slate-800">{formatCurrency(uninvoicedWip)}</p>
                </div>
                <div />
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Balance after WIP</p>
                  <p className={cn(
                    'text-sm font-semibold',
                    balanceAfterWip !== null && balanceAfterWip < 0 ? 'text-red-600' : 'text-slate-800'
                  )}>
                    {balanceAfterWip !== null ? formatCurrency(balanceAfterWip) : '—'}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Work in Progress</p>
              <p className="text-sm font-semibold text-slate-800">{formatCurrency(workDone)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Invoiced</p>
              <p className="text-sm font-semibold text-slate-800">{formatCurrency(invoiced)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">To Invoice</p>
              <p className={cn(
                'text-sm font-semibold',
                toInvoice < 0 ? 'text-red-600' : 'text-green-700'
              )}>
                {formatCurrency(toInvoice)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Invoices that have claimed against this task */}
      {invoices.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-1">
          <p className="uppercase tracking-widest text-[10px] font-semibold text-slate-400 mb-1.5">Invoices</p>
          <div className="space-y-1">
            {invoices.map(inv => (
              <Link
                key={inv.id}
                href={`/projects/${jobNumber}/invoices/${inv.id}`}
                className="flex items-center justify-between gap-2 text-xs hover:bg-slate-50 -mx-1 px-1 py-0.5 rounded transition-colors"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <Receipt className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="font-mono text-slate-700 truncate">{inv.invoice_number}</span>
                  <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                </span>
                <span className="tabular-nums text-slate-600 shrink-0">{formatCurrency(inv.amount)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Approval / quote acceptance reference */}
      {(() => {
        const prep = Array.isArray(task.approval_prepared_by_profile)
          ? task.approval_prepared_by_profile[0]
          : task.approval_prepared_by_profile
        const quote = Array.isArray(task.quote) ? task.quote[0] : task.quote
        const quotePrep = quote
          ? (Array.isArray(quote.created_by_profile) ? quote.created_by_profile[0] : quote.created_by_profile)
          : null

        const hasManualApproval = prep || task.approval_approved_by || task.approval_method || task.approval_date
        const hasQuote = !!quote
        if (!hasManualApproval && !hasQuote) return null

        const dateStr = task.approval_date
          ? new Date(task.approval_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
          : null
        const quoteDateStr = quote?.approved_at
          ? new Date(quote.approved_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
          : null

        return (
          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-0.5">
            <p className="uppercase tracking-widest text-[10px] font-semibold text-slate-400">Approval</p>

            {hasQuote && quote && (
              <>
                <p>From Quote <span className="text-slate-700 font-medium">{quote.quote_number}</span></p>
                {quotePrep?.full_name && <p>Prepared by <span className="text-slate-700 font-medium">{quotePrep.full_name}</span></p>}
                {quote.contact_name && <p>Approved by <span className="text-slate-700 font-medium">{quote.contact_name}</span></p>}
                {quoteDateStr && <p>Accepted on <span className="text-slate-700 font-medium">{quoteDateStr}</span></p>}
              </>
            )}

            {hasManualApproval && (
              <>
                {prep?.full_name && <p>Prepared by <span className="text-slate-700 font-medium">{prep.full_name}</span></p>}
                {task.approval_approved_by && <p>Approved by <span className="text-slate-700 font-medium">{task.approval_approved_by}</span></p>}
                {(task.approval_method || dateStr) && (
                  <p>
                    Via <span className="capitalize text-slate-700 font-medium">{task.approval_method ?? '—'}</span>
                    {dateStr ? <> on <span className="text-slate-700 font-medium">{dateStr}</span></> : null}
                  </p>
                )}
              </>
            )}
          </div>
        )
      })()}

      {/* Assigned staff */}
      {assignedStaff.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
          {assignedStaff.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              <span className="w-4 h-4 rounded-full bg-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600">
                {s.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </span>
              {s.full_name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
