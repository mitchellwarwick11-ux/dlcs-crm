import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { QUOTE_TEMPLATES } from '@/lib/constants/quote-templates'
import { PrintBar } from '@/app/print/print-bar'

export default async function PrintQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>
  searchParams: Promise<{ template?: string }>
}) {
  const { quoteId }        = await params
  const { template: tKey } = await searchParams

  const supabase = await createClient()
  const db = supabase as any

  const [{ data: quote }, { data: items }, { data: rates }, { data: settingsRows }] = await Promise.all([
    db
      .from('quotes')
      .select(`
        id, quote_number, contact_name, contact_email, contact_phone,
        site_address, suburb, lot_number, plan_number,
        subtotal, gst_amount, total, valid_until, notes, created_at,
        selected_scope_items, specified_scope_items, selected_note_items,
        clients ( name, company_name )
      `)
      .eq('id', quoteId)
      .single(),
    db
      .from('quote_items')
      .select('id, description, quantity, unit_price, amount, sort_order')
      .eq('quote_id', quoteId)
      .order('sort_order'),
    db
      .from('role_rates')
      .select('label, hourly_rate, sort_order')
      .eq('is_active', true)
      .order('sort_order'),
    db.from('company_settings').select('key, value'),
  ])

  const settings: Record<string, string> = {}
  for (const row of (settingsRows ?? [])) settings[row.key] = row.value
  const companyName = settings.company_name || 'Delfs Lascelles Consulting Surveyors'
  const abn         = settings.abn || ''

  if (!quote) notFound()

  const q          = quote as any
  const itemList   = (items ?? []) as any[]
  const rateList   = (rates ?? []) as any[]
  const clientName = q.clients?.company_name ?? q.clients?.name ?? null

  // Standard inclusions: stored selected_scope_items or template fallback
  const storedItems = (q.selected_scope_items as string[] | null) ?? []
  const templateScopeItems = tKey ? (QUOTE_TEMPLATES[tKey]?.scopeItems ?? []) : []
  const scopeItems  = storedItems.length > 0 ? storedItems : templateScopeItems
  // Specified inclusions: free-form items added per-quote
  const specItems   = (q.specified_scope_items as string[] | null) ?? []

  // Use stored selected_note_items if present, else fall back to hardcoded defaults
  const storedNotes = (q.selected_note_items as string[] | null) ?? []
  const defaultNotes = [
    'Any additional work requested will be undertaken at the below Standard Hourly Rates.',
    'No allowance has been made for boundary marking.',
    'The above fee does not include council/certifier or LRS fees.',
  ]
  const noteItems = storedNotes.length > 0 ? storedNotes : defaultNotes

  // Valid until text
  const validText = q.valid_until
    ? `Costings valid until ${formatDate(q.valid_until)}`
    : 'Costings valid for 60 days of pricing'

  return (
    <html lang="en">
      <head>
        <title>{q.quote_number} — Fee Proposal</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: Arial, sans-serif;
            font-size: 10pt;
            color: #1e293b;
            background: white;
          }
          .page {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20mm 20mm 15mm 20mm;
            min-height: 297mm;
            position: relative;
          }
          h1 { font-size: 20pt; font-weight: bold; color: #1e293b; line-height: 1.2; }
          h2 { font-size: 9pt; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; margin-bottom: 4pt; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16pt; }
          .company-name { font-size: 16pt; font-weight: bold; color: #1e293b; }
          .company-sub { font-size: 9pt; color: #64748b; margin-top: 2pt; }
          .header-right { text-align: right; font-size: 9pt; line-height: 1.7; }
          .header-right strong { font-weight: 600; }
          .divider { border: none; border-top: 1.5pt solid #cbd5e1; margin-bottom: 16pt; }
          .title-block { margin-bottom: 14pt; }
          .attention-block { margin-bottom: 12pt; font-size: 10pt; line-height: 1.6; }
          .label { font-size: 8.5pt; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; margin-bottom: 3pt; }
          .site-block { margin-bottom: 14pt; }
          .scope-block { margin-bottom: 14pt; }
          .scope-table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
          .scope-table td { padding: 5pt 0; font-size: 10pt; }
          .scope-table td:last-child { text-align: right; font-weight: 600; white-space: nowrap; padding-left: 16pt; }
          .scope-table tr { border-bottom: 0.5pt solid #e2e8f0; }
          .scope-items { list-style: none; padding: 0; }
          .scope-items li { display: flex; gap: 8pt; font-size: 9.5pt; line-height: 1.5; margin-bottom: 3pt; color: #334155; }
          .scope-items li::before { content: "•"; flex-shrink: 0; color: #64748b; }
          .note-block { margin-bottom: 14pt; }
          .note-items { list-style: none; padding: 0; }
          .note-items li { display: flex; gap: 6pt; font-size: 9pt; line-height: 1.5; color: #475569; margin-bottom: 2pt; }
          .note-items li::before { content: "•"; flex-shrink: 0; color: #94a3b8; }
          .rates-block { margin-bottom: 16pt; }
          .rates-table { border-collapse: collapse; }
          .rates-table td { font-size: 9.5pt; padding: 3pt 0; }
          .rates-table td:first-child { padding-right: 40pt; }
          .rates-table td:last-child { font-weight: 600; }
          .fee-block { border-top: 2pt solid #1e293b; padding-top: 10pt; margin-bottom: 16pt; display: flex; justify-content: space-between; align-items: flex-start; }
          .fee-label { font-size: 10pt; font-weight: bold; text-transform: uppercase; }
          .fee-terms { font-size: 8.5pt; color: #64748b; margin-top: 3pt; line-height: 1.5; }
          .fee-amount { font-size: 22pt; font-weight: bold; color: #1e293b; }
          .notes-block { margin-bottom: 16pt; }
          .accepted-block { margin-bottom: 16pt; }
          .accepted-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; margin-bottom: 6pt; }
          .accepted-sub { font-size: 9pt; color: #475569; margin-bottom: 20pt; }
          .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30pt; }
          .sig-line { border-bottom: 0.75pt solid #94a3b8; padding-bottom: 30pt; margin-bottom: 4pt; }
          .sig-label { font-size: 8.5pt; color: #94a3b8; }
          .footer { border-top: 0.75pt solid #e2e8f0; padding-top: 10pt; margin-top: 20pt; }
          .footer-regards { font-size: 9pt; color: #64748b; margin-bottom: 2pt; }
          .footer-company { font-size: 10pt; font-weight: 600; color: #1e293b; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .page { padding: 15mm 18mm 12mm 18mm; }
            .no-print { display: none !important; }
          }
        `}</style>
      </head>
      <body>
        <PrintBar />

        <div className="page">

          {/* Header */}
          <div className="header">
            <div>
              <div className="company-name">{companyName}</div>
              {abn && <div className="company-sub">ABN: {abn}</div>}
            </div>
            <div className="header-right">
              <div><strong>Date:</strong> {formatDate(q.created_at)}</div>
              <div><strong>Reference:</strong> {q.quote_number}</div>
              {q.contact_email && <div><strong>SENT:</strong> {q.contact_email}</div>}
            </div>
          </div>

          <hr className="divider" />

          {/* Title */}
          <div className="title-block">
            <h1>Fee Proposal<br />Survey Services</h1>
          </div>

          {/* Attention */}
          {(q.contact_name || clientName) && (
            <div className="attention-block">
              {q.contact_name && <div><strong>Attention</strong> {q.contact_name}</div>}
              {clientName && <div>c/ {clientName}</div>}
            </div>
          )}

          {/* Site Address */}
          {(q.site_address || q.suburb || q.lot_number || q.plan_number) && (
            <div className="site-block">
              <div className="label">Site Address</div>
              {(q.site_address || q.suburb) && (
                <div>{[q.site_address, q.suburb].filter(Boolean).join(', ')}</div>
              )}
              {(q.lot_number || q.plan_number) && (
                <div style={{ color: '#64748b', fontSize: '9pt', marginTop: '2pt' }}>
                  {[q.lot_number && `Lot ${q.lot_number}`, q.plan_number].filter(Boolean).join(' ')}
                </div>
              )}
            </div>
          )}

          {/* Scope of Work */}
          <div className="scope-block">
            <h2>Scope of Work</h2>

            {/* Line items (the fee breakdown) */}
            <table className="scope-table">
              <tbody>
                {itemList.map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td>{formatCurrency(item.unit_price)} ex GST</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Standard Inclusions */}
            {scopeItems.length > 0 && (
              <>
                <div style={{ fontSize: '7pt', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8', margin: '8pt 0 4pt' }}>
                  Standard Inclusions
                </div>
                <ul className="scope-items">
                  {scopeItems.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}

            {/* Specified Inclusions */}
            {specItems.length > 0 && (
              <>
                <div style={{ fontSize: '7pt', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8', margin: '8pt 0 4pt' }}>
                  Specified Inclusions
                </div>
                <ul className="scope-items" style={{ listStyle: 'none', padding: 0 }}>
                  {specItems.map((s, i) => (
                    <li key={i} style={{ display: 'flex', gap: '8pt', fontSize: '9.5pt', lineHeight: '1.5', marginBottom: '3pt', color: '#334155' }}>
                      <span style={{ flexShrink: 0, color: '#0ea5e9' }}>◆</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Please Note */}
          {noteItems.length > 0 && (
            <div className="note-block">
              <h2>Please Note</h2>
              <ul className="note-items">
                {noteItems.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Standard Hourly Rates */}
          {rateList.length > 0 && (
            <div className="rates-block">
              <h2>Standard Hourly Rates (ex GST)</h2>
              <table className="rates-table">
                <tbody>
                  {rateList.map((r: any) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td>{formatCurrency(r.hourly_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Proposed Fee */}
          <div className="fee-block">
            <div>
              <div className="fee-label">Proposed Fee (ex GST)</div>
              <div className="fee-terms">
                {validText}<br />
                Payment due within 14 days upon invoice received
              </div>
            </div>
            <div className="fee-amount">{formatCurrency(q.subtotal)}</div>
          </div>

          {/* Notes */}
          {q.notes && (
            <div className="notes-block">
              <h2>Notes</h2>
              <div style={{ fontSize: '9.5pt', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{q.notes}</div>
            </div>
          )}

          {/* Acceptance */}
          <div className="accepted-block">
            <div className="accepted-title">Accepted</div>
            <div className="accepted-sub">I/We accept this fee proposal and the payment terms as quoted above.</div>
            <div className="sig-grid">
              <div>
                <div className="sig-line"></div>
                <div className="sig-label">Signature</div>
              </div>
              <div>
                <div className="sig-line"></div>
                <div className="sig-label">Date</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="footer">
            <div className="footer-regards">Kind Regards</div>
            <div className="footer-company">{companyName}</div>
            {abn && <div style={{ fontSize: '8.5pt', color: '#64748b', marginTop: '1pt' }}>ABN: {abn}</div>}
          </div>

        </div>
      </body>
    </html>
  )
}
