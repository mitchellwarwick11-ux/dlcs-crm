import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { InvoiceStatusActions } from '@/components/invoices/invoice-status-actions'
import { PrintInvoiceButton } from '@/components/invoices/print-invoice-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { ArrowLeft } from 'lucide-react'
import type { InvoiceStatus } from '@/types/database'

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ jobNumber: string; invoiceId: string }>
}) {
  const { jobNumber, invoiceId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const [{ data: invoice }, itemsResult] = await Promise.all([
    db
      .from('invoices')
      .select('*, quotes ( quote_number, contact_name, contact_email )')
      .eq('id', invoiceId)
      .single(),
    // Try extended query first (requires task_id / prev_claimed_amount columns)
    db
      .from('invoice_items')
      .select(`
        id, description, quantity, unit_price, amount, sort_order,
        task_id, prev_claimed_amount,
        project_tasks ( title, fee_type, quoted_amount ),
        time_entries!time_entry_id ( date, staff_profiles ( full_name ) )
      `)
      .eq('invoice_id', invoiceId)
      .order('sort_order'),
  ])

  // If the extended query failed (e.g. migration not yet run), fall back to simple query
  let items = itemsResult.data
  if (itemsResult.error || !items) {
    const fallback = await db
      .from('invoice_items')
      .select('id, description, quantity, unit_price, amount, sort_order')
      .eq('invoice_id', invoiceId)
      .order('sort_order')
    items = fallback.data
  }

  if (!invoice) notFound()

  const inv      = invoice as any
  const itemList = (items ?? []) as any[]

  // Separate cost items (no task link) from task items
  // Cost items: task_id is null AND project_tasks is null (i.e. not a legacy ungrouped task row)
  const costItems  = itemList.filter(i => i.task_id == null && i.project_tasks == null)
  const taskItems  = itemList.filter(i => i.task_id != null || i.project_tasks != null)

  // Group task items into sections (order preserved from sort_order)
  type TaskGroup = {
    taskId:    string
    title:     string
    feeType:   'fixed' | 'hourly'
    quoted?:   number
    prevClaimed?: number
    thisClaim?:   number
    remaining?:   number
    claimLabel?:  'Progress Claim' | 'Final Claim'
    rows: typeof itemList
  }

  // Does this invoice have rich task data (migration was run + invoice created with new form)?
  const hasTaskData = taskItems.some(i => i.task_id != null)

  const groupMap = new Map<string, TaskGroup>()
  for (const item of taskItems) {
    const key     = item.task_id ?? `__item_${item.id}`
    const feeType = (item.project_tasks?.fee_type ?? null) as 'fixed' | 'hourly' | null

    if (!groupMap.has(key)) {
      const quoted      = item.project_tasks?.quoted_amount ?? 0
      const prevClaimed = (item.prev_claimed_amount as number | null) ?? 0
      const thisClaim   = feeType === 'fixed' ? (item.amount ?? item.unit_price) : 0
      const remaining   = Math.max(0, quoted - prevClaimed - thisClaim)

      groupMap.set(key, {
        taskId:    key,
        title:     item.project_tasks?.title ?? item.description,
        feeType:   feeType ?? 'fixed',
        quoted,
        prevClaimed,
        thisClaim,
        remaining,
        claimLabel: feeType === 'fixed' && hasTaskData
          ? (remaining <= 0.005 ? 'Final Claim' : 'Progress Claim')
          : undefined,
        rows: [],
      })
    }
    groupMap.get(key)!.rows.push(item)
  }

  const taskGroups = Array.from(groupMap.values())

  return (
    <div className="p-8 max-w-3xl space-y-6">

      {/* Back link */}
      <Link
        href={`/projects/${jobNumber}/invoices`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Invoices
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-slate-900">{inv.invoice_number}</span>
            <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
          </div>
          {inv.quotes?.quote_number && (
            <p className="text-xs text-slate-400 mt-1">
              Linked to quote{' '}
              <Link href={`/quotes/${inv.quote_id}`} className="hover:text-blue-600">
                {inv.quotes.quote_number}
              </Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <InvoiceStatusActions invoiceId={inv.id} status={inv.status as InvoiceStatus} />
          <PrintInvoiceButton invoiceId={inv.id} />
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Contact</div>
          <div className="text-slate-800">{inv.quotes?.contact_name || <span className="text-slate-400">—</span>}</div>
          {inv.quotes?.contact_email && (
            <div className="text-xs text-slate-500">{inv.quotes.contact_email}</div>
          )}
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Due Date</div>
          <div className="text-slate-800">{inv.due_date ? formatDate(inv.due_date) : <span className="text-slate-400">—</span>}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Created</div>
          <div className="text-slate-800">{formatDate(inv.created_at)}</div>
        </div>
        {inv.sent_at && (
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Sent</div>
            <div className="text-slate-800">{formatDate(inv.sent_at)}</div>
          </div>
        )}
        {inv.paid_at && (
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Paid</div>
            <div className="text-green-700 font-medium">{formatDate(inv.paid_at)}</div>
          </div>
        )}
      </div>

      {/* Task sections */}
      <div className="space-y-4">
        {taskGroups.map(group => (
          <Card key={group.taskId}>
            {/* Task header */}
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-800">{group.title}</CardTitle>
                {group.claimLabel && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    group.claimLabel === 'Final Claim'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {group.claimLabel}
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Fixed fee — vertical breakdown (only when task data available) */}
              {group.feeType === 'fixed' && hasTaskData && (
                <div className="px-4 py-4 divide-y divide-slate-100">
                  <div className="flex justify-between py-2.5 text-sm">
                    <span className="text-slate-500">Quoted (Fixed Fee)</span>
                    <span className="tabular-nums text-slate-700">{formatCurrency(group.quoted ?? 0)}</span>
                  </div>
                  <div className="flex justify-between py-2.5 text-sm">
                    <span className="text-slate-500">Previously Claimed</span>
                    <span className="tabular-nums text-slate-700">{formatCurrency(group.prevClaimed ?? 0)}</span>
                  </div>
                  <div className="flex justify-between py-3 text-sm font-semibold text-slate-900">
                    <span>This Claim</span>
                    <span className="tabular-nums">{formatCurrency(group.thisClaim ?? 0)}</span>
                  </div>
                  <div className="flex justify-between py-2.5 text-sm">
                    <span className="text-slate-500">Remaining After This Claim</span>
                    <span className={`tabular-nums font-medium ${(group.remaining ?? 0) <= 0.005 ? 'text-green-700' : 'text-slate-700'}`}>
                      {formatCurrency(group.remaining ?? 0)}
                    </span>
                  </div>
                </div>
              )}

              {/* Fixed fee — simple display (old invoices without task data) */}
              {group.feeType === 'fixed' && !hasTaskData && (
                <div className="px-4 py-4 flex justify-between text-sm">
                  <span className="text-slate-700">{group.rows[0]?.description}</span>
                  <span className="tabular-nums font-semibold text-slate-900">{formatCurrency(group.rows[0]?.amount ?? 0)}</span>
                </div>
              )}

              {/* Hourly — time entry rows */}
              {group.feeType === 'hourly' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Staff</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Description</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Hours</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Rate</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.rows.map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2.5 text-slate-600 text-xs whitespace-nowrap">
                          {item.time_entries?.date ? formatDate(item.time_entries.date) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs whitespace-nowrap">
                          {item.time_entries?.staff_profiles?.full_name ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 text-xs">{item.description}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums text-xs">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums text-xs">{formatCurrency(item.unit_price)}/h</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-900 tabular-nums">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Cost / disbursement items — simple single line each */}
        {costItems.map((item: any) => (
          <Card key={item.id}>
            <CardContent className="px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-slate-800">{item.description}</span>
              <span className="tabular-nums font-semibold text-slate-900">
                {formatCurrency(item.unit_price ?? item.amount ?? 0)}
              </span>
            </CardContent>
          </Card>
        ))}

        {/* Invoice totals */}
        <Card>
          <CardContent className="px-4 py-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal (ex GST)</span>
              <span className="tabular-nums">{formatCurrency(inv.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>GST (10%)</span>
              <span className="tabular-nums">{formatCurrency(inv.gst_amount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-900 text-base pt-2 border-t border-slate-200">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(inv.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {inv.notes && (
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Notes</div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{inv.notes}</p>
        </div>
      )}

    </div>
  )
}
