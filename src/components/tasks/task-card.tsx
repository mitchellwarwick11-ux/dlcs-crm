'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { TASK_STATUSES, TASK_STATUS_COLOURS, TASK_STATUS_CYCLE, FEE_TYPES } from '@/lib/constants/statuses'
import { formatCurrency } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { Pencil, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/lib/constants/statuses'

interface AssignedStaff {
  id: string
  full_name: string
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
  }
  assignedStaff: AssignedStaff[]
  workDone: number      // sum of hours × rate (from time_entries)
  invoiced: number      // sum of invoice_items (from sent/paid invoices)
  jobNumber: string
}

export function TaskCard({ task, assignedStaff, workDone, invoiced, jobNumber }: TaskCardProps) {
  const router = useRouter()
  const [status, setStatus] = useState(task.status)
  const [cycling, setCycling] = useState(false)

  async function cycleStatus() {
    const cycleList = TASK_STATUS_CYCLE
    const currentIdx = cycleList.indexOf(status as TaskStatus)
    const nextStatus = currentIdx === -1 || currentIdx === cycleList.length - 1
      ? cycleList[0]
      : cycleList[currentIdx + 1]

    setCycling(true)
    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('project_tasks')
      .update({ status: nextStatus })
      .eq('id', task.id)

    if (!error) {
      setStatus(nextStatus)
      router.refresh()
    }
    setCycling(false)
  }

  const statusLabel = TASK_STATUSES[status as TaskStatus] ?? status
  const statusColour = TASK_STATUS_COLOURS[status] ?? 'bg-slate-100 text-slate-600'
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
          {/* Status cycle button */}
          <button
            onClick={cycleStatus}
            disabled={cycling || status === 'cancelled'}
            title="Click to advance status"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity',
              statusColour,
              status !== 'cancelled' && 'cursor-pointer hover:opacity-80',
              cycling && 'opacity-50'
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {statusLabel}
            {status !== 'cancelled' && <ChevronRight className="h-3 w-3" />}
          </button>

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
