import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { QuoteStatusBadge } from '@/components/quotes/quote-status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { FileText, Settings2 } from 'lucide-react'
import type { QuoteStatus } from '@/types/database'

const STATUS_TABS: { label: string; value: QuoteStatus | 'all' }[] = [
  { label: 'All',       value: 'all'      },
  { label: 'Draft',     value: 'draft'    },
  { label: 'Issued',    value: 'issued'   },
  { label: 'Accepted',  value: 'accepted' },
  { label: 'Declined',  value: 'declined' },
  { label: 'Cancelled', value: 'cancelled'},
]

export default async function QuotesHubPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any
  const activeStatus = params.status ?? 'all'

  let query = db
    .from('quotes')
    .select(`
      id, quote_number, status, subtotal, gst_amount, total,
      valid_until, created_at,
      contact_name, site_address, suburb,
      clients ( name, company_name ),
      projects ( job_number ),
      staff_profiles ( full_name )
    `)
    .order('created_at', { ascending: false })

  if (activeStatus !== 'all') {
    query = query.eq('status', activeStatus)
  }

  const { data: quotes } = await query
  const quoteList = (quotes ?? []) as any[]

  // Count per status for tab badges
  const { data: allQuotes } = await db.from('quotes').select('status')
  const counts: Record<string, number> = {}
  for (const q of (allQuotes ?? [])) {
    counts[q.status] = (counts[q.status] ?? 0) + 1
  }
  const totalCount = (allQuotes ?? []).length

  return (
    <div className="p-8 space-y-6 max-w-6xl">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Quotes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{totalCount} quote{totalCount !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/quotes/templates" title="Manage Templates">
            <Button size="sm" variant="outline">
              <Settings2 className="h-4 w-4 mr-1.5" />
              Templates
            </Button>
          </Link>
          <Link href="/quotes/fee-proposal/new">
            <Button size="sm">
              <FileText className="h-4 w-4 mr-1.5" />
              Prepare Fee Proposal
            </Button>
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-slate-200 -mb-1">
        {STATUS_TABS.map(tab => {
          const count = tab.value === 'all' ? totalCount : (counts[tab.value] ?? 0)
          const isActive = activeStatus === tab.value
          return (
            <Link
              key={tab.value}
              href={tab.value === 'all' ? '/quotes' : `/quotes?status=${tab.value}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Quote list */}
      {quoteList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <p className="text-sm text-slate-500 mb-4">
            {activeStatus === 'all' ? 'No quotes yet.' : `No ${activeStatus} quotes.`}
          </p>
          <Link href="/quotes/fee-proposal/new">
            <Button size="sm" variant="outline">
              <FileText className="h-4 w-4 mr-1.5" />
              Prepare Fee Proposal
            </Button>
          </Link>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Quote #</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Client / Site</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Job</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Fee (ex GST)</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Valid Until</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Created By</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quoteList.map((q: any) => {
                  const clientName = q.clients?.company_name ?? q.clients?.name ?? q.contact_name ?? null
                  const site = q.suburb ?? q.site_address ?? null
                  return (
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
                        {clientName && <p className="font-medium text-slate-800 text-xs">{clientName}</p>}
                        {site && <p className="text-slate-400 text-xs">{site}</p>}
                        {!clientName && !site && <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {q.projects?.job_number
                          ? <Link href={`/projects/${q.projects.job_number}/details`} className="font-mono text-xs text-slate-600 hover:text-blue-600">{q.projects.job_number}</Link>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <QuoteStatusBadge status={q.status as QuoteStatus} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(q.subtotal)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {q.valid_until ? formatDate(q.valid_until) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {q.staff_profiles?.full_name ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(q.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
