import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { QuoteStatusBadge } from '@/components/quotes/quote-status-badge'
import { PurchaseOrdersPanel } from '@/components/invoices/purchase-orders-panel'
import { CostItemsPanel } from '@/components/invoices/cost-items-panel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, formatHours } from '@/lib/utils/formatters'
import { Plus, ExternalLink } from 'lucide-react'
import type { InvoiceStatus, QuoteStatus } from '@/types/database'

export default async function ProjectInvoicingPage({
  params,
}: {
  params: Promise<{ jobNumber: string }>
}) {
  const { jobNumber } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('job_number', jobNumber)
    .returns<any[]>()
    .single()

  if (!project) notFound()
  const projectId = (project as any).id

  const [
    { data: quotes },
    { data: invoices },
    { data: timeEntries },
    { data: projectTasks },
    { data: purchaseOrders },
    { data: projectCosts },
  ] = await Promise.all([
    db
      .from('quotes')
      .select('id, quote_number, status, subtotal, gst_amount, total, valid_until, created_at, contact_name')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    db
      .from('invoices')
      .select('id, invoice_number, status, subtotal, gst_amount, total, due_date, sent_at, paid_at, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    db
      .from('time_entries')
      .select('id, hours, rate_at_time, is_billable, invoice_item_id, task_id, project_tasks ( title )')
      .eq('project_id', projectId)
      .is('invoice_item_id', null)
      .eq('is_billable', true),
    db
      .from('project_tasks')
      .select('id, title, fee_type, claimed_amount')
      .eq('project_id', projectId)
      .not('fee_type', 'eq', 'non_billable'),
    db
      .from('purchase_orders')
      .select('id, po_number, issued_by, issued_date, amount, notes')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    db
      .from('project_costs')
      .select('id, description, amount, has_gst, date, invoice_item_id, invoice_items!invoice_item_id(invoices(invoice_number))')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
  ])

  const quoteList   = (quotes         ?? []) as any[]
  const invoiceList = (invoices       ?? []) as any[]
  const entryList   = (timeEntries    ?? []) as any[]
  const taskList    = (projectTasks   ?? []) as any[]
  const poList      = (purchaseOrders ?? []) as any[]
  const costList    = ((projectCosts  ?? []) as any[]).map((c: any) => ({
    ...c,
    invoice_number: c.invoice_items?.invoices?.invoice_number ?? null,
  }))

  const taskMetaMap = new Map(
    taskList.map((task: any) => [
      task.id,
      {
        title: task.title,
        feeType: task.fee_type,
        claimedAmount: task.claimed_amount ?? 0,
      },
    ])
  )

  // ── WIP: group uninvoiced billable time by task ─────────────────────────
  const wipMap = new Map<string, { title: string; hours: number; value: number }>()

  for (const entry of entryList) {
    const taskId    = entry.task_id ?? '__no_task__'
    const taskMeta  = taskMetaMap.get(taskId)
    const taskTitle = taskMeta?.title ?? entry.project_tasks?.title ?? 'No Task'
    const value     = entry.hours * entry.rate_at_time

    if (!wipMap.has(taskId)) {
      wipMap.set(taskId, { title: taskTitle, hours: 0, value: 0 })
    }
    const task = wipMap.get(taskId)!
    task.hours += entry.hours
    task.value += value
  }

  const wipRows = Array.from(wipMap.entries())
    .map(([taskId, row]) => {
      const taskMeta = taskMetaMap.get(taskId)
      if (taskMeta?.feeType === 'fixed') {
        return {
          ...row,
          value: Math.max(row.value - taskMeta.claimedAmount, 0),
        }
      }
      return row
    })
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)

  const wipTotal = wipRows.reduce((sum, row) => sum + row.value, 0)
  const wipHours = wipRows.reduce((sum, row) => sum + row.hours, 0)

  // ── Invoice totals ───────────────────────────────────────────────────────
  const totalInvoiced = invoiceList
    .filter((i: any) => i.status !== 'cancelled')
    .reduce((s: number, i: any) => s + (i.subtotal ?? 0), 0)

  return (
    <div className="p-8 space-y-8 max-w-5xl">

      {/* ── 1. Quotes ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Fee Proposals / Quotes</h2>
            {quoteList.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">{quoteList.length} linked</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/quotes" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              All Quotes
            </Link>
            <Link href={`/quotes/new?related_job=${jobNumber}`}>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1.5" />
                New Quote
              </Button>
            </Link>
          </div>
        </div>

        {quoteList.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
            No quotes linked to this job yet.
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Quote #</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Subtotal</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">GST</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Total</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Valid Until</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quoteList.map((q: any) => (
                    <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/quotes/${q.id}`}
                          className="font-mono font-medium text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {q.quote_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <QuoteStatusBadge status={q.status as QuoteStatus} />
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{formatCurrency(q.subtotal)}</td>
                      <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{formatCurrency(q.gst_amount)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(q.total)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {q.valid_until ? formatDate(q.valid_until) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(q.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── 2. WIP ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Work in Progress (WIP)</h2>
            <p className="text-xs text-slate-400 mt-0.5">Uninvoiced billable time, grouped by task</p>
          </div>
          {wipRows.length > 0 && (
            <Link href={`/projects/${jobNumber}/invoices/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Create Invoice
              </Button>
            </Link>
          )}
        </div>

        {wipRows.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
            No uninvoiced billable time for this job.
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Task</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">WIP Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wipRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-800">{row.title}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Total WIP</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{formatCurrency(wipTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── 3. Costs ──────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-slate-900">Costs</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Disbursements and pass-through costs. GST applies per item — most govt/search fees are GST-free.
          </p>
        </div>
        <Card>
          <CardContent className="p-4">
            <CostItemsPanel projectId={projectId} initialCosts={costList} />
          </CardContent>
        </Card>
      </section>

      {/* ── 4. Invoices ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Invoices</h2>
            {invoiceList.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                {invoiceList.length} invoice{invoiceList.length !== 1 ? 's' : ''} · {formatCurrency(totalInvoiced)} ex GST invoiced
              </p>
            )}
          </div>
          <Link href={`/projects/${jobNumber}/invoices/new`}>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1.5" />
              New Invoice
            </Button>
          </Link>
        </div>

        {invoiceList.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
            No invoices issued for this job yet.
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Invoice #</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Subtotal</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Total (inc GST)</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Due Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Sent</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoiceList.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/projects/${jobNumber}/invoices/${inv.id}`}
                          className="font-mono font-medium text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{formatCurrency(inv.subtotal)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {inv.due_date ? formatDate(inv.due_date) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {inv.sent_at ? formatDate(inv.sent_at) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {inv.paid_at ? formatDate(inv.paid_at) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {invoiceList.filter((i: any) => i.status !== 'cancelled').length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={2} className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Total Invoiced</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{formatCurrency(totalInvoiced)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                        {formatCurrency(totalInvoiced * 1.1)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── 4. Purchase Orders ────────────────────────────────────────── */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-slate-900">Purchase Orders</h2>
          <p className="text-xs text-slate-400 mt-0.5">POs received from the client authorising work on this job</p>
        </div>
        <Card>
          <CardContent className="p-4">
            <PurchaseOrdersPanel projectId={projectId} initialOrders={poList} />
          </CardContent>
        </Card>
      </section>

    </div>
  )
}
