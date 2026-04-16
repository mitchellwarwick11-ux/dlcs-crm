import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { QuoteStatusBadge } from '@/components/quotes/quote-status-badge'
import { QuoteStatusActions } from '@/components/quotes/quote-status-actions'
import { PrintQuoteButton } from '@/components/quotes/print-quote-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { Pencil } from 'lucide-react'
import type { QuoteStatus } from '@/types/database'

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ quoteId: string }>
}) {
  const { quoteId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const { data: quote } = await db
    .from('quotes')
    .select(`
      id, quote_number, status, subtotal, gst_amount, total,
      notes, valid_until, sent_at, approved_at, created_at,
      project_id, client_id,
      contact_name, contact_phone, contact_email,
      site_address, suburb, lot_number, plan_number, job_type,
      clients ( name, company_name ),
      projects ( job_number, title )
    `)
    .eq('id', quoteId)
    .single()

  if (!quote) notFound()

  const { data: items } = await db
    .from('quote_items')
    .select('id, description, quantity, unit_price, amount, sort_order')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true })

  const q        = quote as any
  const itemList = (items ?? []) as any[]
  const isLocked = q.status === 'accepted' || q.status === 'cancelled'

  const clientName = q.clients?.company_name ?? q.clients?.name ?? q.contact_name ?? null
  const hasLinkedJob = !!q.project_id

  return (
    <div className="p-8 space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-mono text-xl font-bold text-slate-900">{q.quote_number}</h1>
            <QuoteStatusBadge status={q.status as QuoteStatus} />
          </div>
          {clientName && <p className="text-sm text-slate-600 font-medium">{clientName}</p>}
          {(q.suburb || q.site_address) && (
            <p className="text-xs text-slate-400">{q.suburb ?? q.site_address}</p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">Created {formatDate(q.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <PrintQuoteButton quoteId={quoteId} />
          {!isLocked && (
            <Link href={`/quotes/${quoteId}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Status actions */}
      <QuoteStatusActions
        quoteId={quoteId}
        status={q.status as QuoteStatus}
        hasLinkedJob={hasLinkedJob}
        projectId={q.project_id}
      />

      {/* Meta row */}
      <div className="flex flex-wrap gap-6 text-sm">
        {q.projects && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Linked Job</p>
            <Link href={`/projects/${q.projects.job_number}/details`} className="font-mono font-medium text-blue-600 hover:underline">
              {q.projects.job_number}
            </Link>
            <span className="text-slate-500 ml-1 text-xs">{q.projects.title}</span>
          </div>
        )}
        {q.valid_until && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Valid Until</p>
            <p className="font-medium text-slate-700">{formatDate(q.valid_until)}</p>
          </div>
        )}
        {q.sent_at && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Issued</p>
            <p className="font-medium text-slate-700">{formatDate(q.sent_at)}</p>
          </div>
        )}
        {q.approved_at && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Accepted</p>
            <p className="font-medium text-slate-700">{formatDate(q.approved_at)}</p>
          </div>
        )}
      </div>

      {/* Contact & Site */}
      {(q.contact_name || q.contact_phone || q.contact_email || q.site_address || q.suburb || q.lot_number) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(q.contact_name || q.contact_phone || q.contact_email) && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
              <CardContent className="pt-0 text-sm space-y-0.5">
                {q.contact_name  && <p className="font-medium text-slate-800">{q.contact_name}</p>}
                {q.contact_phone && <p className="text-slate-500">📞 {q.contact_phone}</p>}
                {q.contact_email && <p className="text-slate-500">✉ {q.contact_email}</p>}
              </CardContent>
            </Card>
          )}
          {(q.site_address || q.suburb || q.lot_number || q.plan_number) && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Site</CardTitle></CardHeader>
              <CardContent className="pt-0 text-sm space-y-0.5">
                {q.site_address && <p className="font-medium text-slate-800">{q.site_address}</p>}
                {q.suburb       && <p className="text-slate-500">{q.suburb}</p>}
                {q.lot_number   && <p className="text-slate-500 text-xs">Lot {q.lot_number}{q.plan_number ? ` ${q.plan_number}` : ''}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Line items */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Description</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide w-20">Qty</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide w-32">Unit Price</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide w-32">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemList.map((item: any) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-slate-800">{item.description}</td>
                  <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800 tabular-nums">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={3} className="px-4 py-2.5 text-right text-sm text-slate-500">Subtotal</td>
                <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-800 tabular-nums">{formatCurrency(q.subtotal)}</td>
              </tr>
              <tr className="bg-slate-50">
                <td colSpan={3} className="px-4 py-2.5 text-right text-sm text-slate-500">GST (10%)</td>
                <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-800 tabular-nums">{formatCurrency(q.gst_amount)}</td>
              </tr>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Total</td>
                <td className="px-4 py-3 text-right text-base font-bold text-slate-900 tabular-nums">{formatCurrency(q.total)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Notes */}
      {q.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{q.notes}</p>
          </CardContent>
        </Card>
      )}

      <div>
        <Link href="/quotes" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
          ← Back to Quotes
        </Link>
      </div>
    </div>
  )
}
