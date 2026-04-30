import { Fragment } from 'react'
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
        selected_quote_tasks, selected_role_keys,
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
      .select('role_key, label, hourly_rate, sort_order')
      .eq('is_active', true)
      .order('sort_order'),
    db.from('company_settings').select('key, value'),
  ])

  const settings: Record<string, string> = {}
  for (const row of (settingsRows ?? [])) settings[row.key] = row.value
  const companyName = settings.company_name || 'Delfs Lascelles Consulting Surveyors'
  const abn         = settings.abn || '28 164 2601 00'
  const phone       = settings.phone || '(02) 4964 4886'
  const address     = settings.address || '260 Maitland Road, Mayfield 2304'
  const email       = settings.email || 'admin@delacs.com.au'
  const website     = settings.website || 'DELACS.COM.AU'

  if (!quote) notFound()

  const q          = quote as any
  const itemList   = (items ?? []) as any[]
  const allRates   = (rates ?? []) as any[]
  const selectedRoleKeys = (q.selected_role_keys as string[] | null) ?? null
  const rateList   = selectedRoleKeys
    ? allRates.filter(r => selectedRoleKeys.includes(r.role_key))
    : allRates
  const clientName = q.clients?.company_name ?? q.clients?.name ?? null

  const quoteTasks = (q.selected_quote_tasks as Array<{
    title: string
    price: number | null
    itemsHeadings: { heading: string; lines: string[] }[]
  }> | null) ?? []

  const storedItems = (q.selected_scope_items as string[] | null) ?? []
  const templateScopeItems = tKey ? (QUOTE_TEMPLATES[tKey]?.scopeItems ?? []) : []
  const scopeItems  = storedItems.length > 0 ? storedItems : templateScopeItems
  const specItems   = (q.specified_scope_items as string[] | null) ?? []
  const inclusions  = [...scopeItems, ...specItems]

  const storedNotes = (q.selected_note_items as string[] | null) ?? []
  const defaultNotes = [
    'Any additional work will be undertaken at the below hourly rates.',
  ]
  const noteItems = storedNotes.length > 0 ? storedNotes : defaultNotes

  const validText = q.valid_until
    ? `costings valid until ${formatDate(q.valid_until)}`
    : 'costings valid for 60 days of pricing'

  const siteAddressLines = [
    q.site_address,
    q.suburb,
    [q.lot_number && `Lot ${q.lot_number}`, q.plan_number].filter(Boolean).join(', '),
  ].filter(Boolean)

  // Distribute inclusions evenly across scope rows as bullets
  const bulletsPerItem: string[][] = itemList.map(() => [])
  if (itemList.length > 0 && inclusions.length > 0) {
    const per = Math.ceil(inclusions.length / itemList.length)
    inclusions.forEach((bullet, i) => {
      const idx = Math.min(Math.floor(i / per), itemList.length - 1)
      bulletsPerItem[idx].push(bullet)
    })
  }

  return (
    <>
      <title>{`${q.quote_number} — Fee Proposal`}</title>
      <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --ink: #1a1a1a;
            --dark: #111111;
            --orange: #e89a3c;
            --peach: #fdf3e2;
            --muted: #8a95a5;
            --label: #64748b;
            --body: #2b2f36;
            --rule: #e5e7eb;
          }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 9.5pt;
            color: var(--body);
            background: white;
          }
          .page {
            max-width: 210mm;
            margin: 0 auto;
            min-height: 297mm;
            position: relative;
            padding-bottom: 60pt;
          }
          /* ======= DARK HEADER ======= */
          .top-bar {
            background: var(--dark);
            color: white;
            padding: 18pt 26pt 22pt 26pt;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            min-height: 90pt;
          }
          .logo-wrap {
            display: flex;
            gap: 10pt;
            align-items: stretch;
          }
          .logo-bar {
            width: 2.5pt;
            background: var(--orange);
          }
          .logo-name {
            font-weight: 800;
            font-size: 16pt;
            line-height: 1.0;
            letter-spacing: 0.01em;
            text-transform: uppercase;
          }
          .logo-sub {
            font-size: 6.5pt;
            letter-spacing: 0.22em;
            color: #cbd5e1;
            margin-top: 4pt;
            text-transform: uppercase;
          }
          .top-contact {
            text-align: right;
            font-size: 8.5pt;
            line-height: 1.55;
            color: #e5e7eb;
          }
          .top-contact .website {
            color: var(--orange);
            font-weight: 700;
            letter-spacing: 0.05em;
            margin-top: 3pt;
            display: inline-block;
            border-bottom: 1pt solid var(--orange);
            padding-bottom: 1pt;
          }
          /* ======= BODY ======= */
          .body-pad { padding: 22pt 26pt 0 26pt; }
          .title-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20pt;
          }
          .fp-title {
            font-size: 22pt;
            font-weight: 800;
            color: var(--ink);
            line-height: 1.05;
            letter-spacing: -0.01em;
          }
          .fp-subtitle {
            font-size: 9pt;
            letter-spacing: 0.28em;
            color: #4b5563;
            margin-top: 6pt;
            padding-bottom: 4pt;
            display: inline-block;
            border-bottom: 1.5pt solid var(--orange);
            text-transform: uppercase;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: auto auto auto;
            column-gap: 10pt;
            row-gap: 2pt;
            font-size: 8.5pt;
            align-items: center;
          }
          .meta-label {
            color: var(--label);
            letter-spacing: 0.18em;
            text-transform: uppercase;
            font-size: 7.5pt;
          }
          .meta-div {
            width: 1pt;
            height: 10pt;
            background: #cbd5e1;
            margin: 0 6pt;
          }
          .meta-val {
            color: var(--ink);
            font-weight: 700;
            font-size: 10pt;
          }
          .meta-sent {
            grid-column: 1 / -1;
            text-align: right;
            color: var(--label);
            font-size: 8pt;
            margin-top: 6pt;
          }
          .hr-full {
            border: none;
            border-top: 0.75pt solid var(--rule);
            margin: 0 26pt 14pt 26pt;
          }
          /* ======= ROW LAYOUT (label | content) ======= */
          .row {
            display: grid;
            grid-template-columns: 88pt 1fr auto;
            column-gap: 18pt;
            padding: 10pt 0;
            border-bottom: 0.5pt solid var(--rule);
          }
          .row-last { border-bottom: none; }
          .row-label {
            font-size: 7.5pt;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--label);
            padding-right: 14pt;
            border-right: 0.75pt solid var(--rule);
            line-height: 1.5;
          }
          .row-content {
            font-size: 9.5pt;
            line-height: 1.55;
            color: var(--body);
          }
          .row-price {
            text-align: right;
            font-size: 13pt;
            font-weight: 700;
            color: var(--ink);
            white-space: nowrap;
            padding-left: 14pt;
            line-height: 1.05;
          }
          .row-price .ex {
            display: block;
            font-size: 7.5pt;
            letter-spacing: 0.15em;
            color: var(--label);
            font-weight: 500;
            margin-top: -1pt;
            text-transform: lowercase;
            line-height: 1;
          }
          .scope-title {
            font-weight: 800;
            font-size: 10.5pt;
            color: var(--ink);
            text-transform: uppercase;
            letter-spacing: 0.02em;
            margin-bottom: 6pt;
          }
          .scope-bullets {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .scope-bullets li {
            padding: 1pt 0;
            font-size: 9pt;
            color: #3b4250;
            line-height: 1.4;
          }
          .attn-name {
            font-weight: 800;
            font-size: 10pt;
            color: var(--ink);
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }
          .site-line { font-size: 9.5pt; line-height: 1.6; }
          /* ======= RATES ======= */
          .rates-row .row-content {
            display: grid;
            grid-template-columns: 1fr auto;
            row-gap: 3pt;
            column-gap: 40pt;
            font-size: 9pt;
          }
          .rates-row .row-content .rate-amt {
            text-align: right;
            font-weight: 600;
            color: var(--ink);
          }
          /* ======= FEE BOX ======= */
          .fee-row {
            display: grid;
            grid-template-columns: 88pt 1fr;
            column-gap: 18pt;
            margin-top: 14pt;
            padding: 0;
          }
          .fee-label-col {
            font-size: 7.5pt;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--label);
            padding: 14pt 14pt 0 0;
            border-right: 0.75pt solid var(--rule);
            line-height: 1.4;
          }
          .fee-label-col .sub {
            display: block;
            font-size: 7pt;
            margin-top: 2pt;
          }
          .fee-box {
            background: var(--peach);
            border-left: 3pt solid var(--orange);
            padding: 16pt 18pt;
          }
          .fee-amount-line {
            display: flex;
            align-items: baseline;
            gap: 8pt;
            flex-wrap: wrap;
          }
          .fee-amount {
            font-size: 20pt;
            font-weight: 800;
            color: var(--ink);
            letter-spacing: -0.01em;
          }
          .fee-ex {
            font-size: 7.5pt;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--label);
          }
          .fee-valid {
            font-size: 8.5pt;
            font-style: italic;
            color: #6b7280;
          }
          .fee-terms {
            font-size: 9pt;
            font-weight: 700;
            color: var(--ink);
            margin-top: 6pt;
          }
          /* ======= SIGN-OFF ======= */
          .signoff { padding: 28pt 26pt 0 26pt; }
          .signoff-line { font-size: 9pt; color: #3b4250; margin-bottom: 14pt; }
          .signoff-regards { font-size: 9pt; color: #3b4250; margin-bottom: 8pt; }
          .sig-script {
            font-family: 'Brush Script MT', 'Lucida Handwriting', cursive;
            font-size: 18pt;
            color: var(--orange);
            font-style: italic;
            border-bottom: 1pt solid var(--orange);
            display: inline-block;
            padding-bottom: 2pt;
            margin-bottom: 6pt;
          }
          .sig-name { font-size: 10pt; font-weight: 700; color: var(--ink); margin-top: 4pt; }
          .sig-role { font-size: 8.5pt; color: var(--label); }
          .sig-reg { font-size: 7.5pt; color: var(--label); margin-top: 1pt; }
          /* ======= BOTTOM BAR ======= */
          .bottom-bar {
            position: absolute;
            bottom: 0;
            left: 0; right: 0;
            background: var(--dark);
            color: #e5e7eb;
            padding: 10pt 26pt;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8pt;
          }
          .bottom-bar .right {
            display: flex;
            align-items: center;
            gap: 12pt;
          }
          .bottom-bar .web { font-weight: 700; letter-spacing: 0.08em; }
          .bottom-bar .div { width: 1pt; height: 10pt; background: #4b5563; }
          .bottom-bar .abn { color: #cbd5e1; letter-spacing: 0.05em; }
          .bottom-bar .accent {
            width: 16pt; height: 3pt; background: var(--orange); margin-left: 8pt;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 0; }
          }
        `}</style>

      <PrintBar />

      <div className="page">

          {/* ===== DARK HEADER ===== */}
          <div className="top-bar">
            <div className="logo-wrap">
              <div className="logo-bar" />
              <div>
                <div className="logo-name">DELFS<br />LASCELLES</div>
                <div className="logo-sub">Consulting Surveyors</div>
              </div>
            </div>
            <div className="top-contact">
              <div>{phone}</div>
              <div>{address}</div>
              <div>{email}</div>
              <div><span className="website">{website}</span></div>
            </div>
          </div>

          {/* ===== TITLE + META ===== */}
          <div className="body-pad">
            <div className="title-row">
              <div>
                <div className="fp-title">FEE PROPOSAL</div>
                <div className="fp-subtitle">Survey Services</div>
              </div>
              <div>
                <div className="meta-grid">
                  <div className="meta-label">Date</div>
                  <div className="meta-div" />
                  <div className="meta-val">{formatDate(q.created_at)}</div>
                  <div className="meta-label">Reference</div>
                  <div className="meta-div" />
                  <div className="meta-val">{q.quote_number}</div>
                </div>
                {(q.contact_name || q.contact_email) && (
                  <div className="meta-sent">
                    SENT: {q.contact_name ?? ''}{q.contact_email ? `  ${q.contact_email}` : ''}
                  </div>
                )}
              </div>
            </div>
          </div>

          <hr className="hr-full" />

          <div className="body-pad" style={{ paddingTop: 0 }}>

            {/* ===== ATTENTION ===== */}
            {q.contact_name && (
              <div className="row">
                <div className="row-label">Attention</div>
                <div className="row-content">
                  <div className="attn-name">{q.contact_name}</div>
                </div>
                <div />
              </div>
            )}

            {/* ===== COMPANY ===== */}
            {clientName && (
              <div className="row">
                <div className="row-label">Company</div>
                <div className="row-content">
                  <div className="attn-name">{clientName}</div>
                </div>
                <div />
              </div>
            )}

            {/* ===== SITE ADDRESS ===== */}
            {siteAddressLines.length > 0 && (
              <div className="row">
                <div className="row-label">Site Address</div>
                <div className="row-content">
                  {siteAddressLines.map((line, i) => (
                    <div key={i} className="site-line">{line}</div>
                  ))}
                </div>
                <div />
              </div>
            )}

            {/* spacer */}
            <div style={{ height: 10 }} />

            {/* ===== QUOTE TASKS (new hierarchical body) ===== */}
            {quoteTasks.length > 0 ? (
              quoteTasks.map((task, ti) => {
                const renderable = task.itemsHeadings
                  .map(h => ({ heading: h.heading, lines: (h.lines || []).filter(l => l && l.trim()) }))
                  .filter(h => h.heading || h.lines.length > 0)
                return (
                  <div key={ti} style={{ borderBottom: '0.5pt solid var(--rule)', paddingBottom: '6pt', marginBottom: '2pt' }}>
                    {/* Task title (starts at the far-left gutter, spans across content area) + price */}
                    {(task.title || (task.price != null && task.price > 0)) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: '18pt', paddingTop: '4pt', paddingBottom: '2pt' }}>
                        <div style={{ fontWeight: 800, fontSize: '10.5pt', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.3 }}>
                          {task.title || ''}
                        </div>
                        <div className="row-price">
                          {task.price != null && task.price > 0 ? formatCurrency(task.price) : '—'}
                          <span className="ex">ex GST</span>
                        </div>
                      </div>
                    )}
                    {/* One sub-row per items heading */}
                    {renderable.map((h, hi) => (
                      <div key={hi} className="row" style={{ borderBottom: 'none', paddingTop: '2pt', paddingBottom: '2pt' }}>
                        <div className="row-label">
                          {h.heading}
                        </div>
                        <div className="row-content">
                          {h.lines.length > 0 && (
                            <ul className="scope-bullets">
                              {h.lines.map((line, li) => <li key={li}>{line}</li>)}
                            </ul>
                          )}
                        </div>
                        <div />
                      </div>
                    ))}
                  </div>
                )
              })
            ) : (
              /* Legacy fallback: quote_items table */
              itemList.map((item: any, i: number) => (
                <div className="row" key={item.id}>
                  <div className="row-label">Scope<br />of Work</div>
                  <div className="row-content">
                    <div className="scope-title">{item.description}</div>
                    {bulletsPerItem[i]?.length > 0 && (
                      <ul className="scope-bullets">
                        {bulletsPerItem[i].map((b, bi) => (
                          <li key={bi}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="row-price">
                    {formatCurrency(item.unit_price)}
                    <span className="ex">ex GST</span>
                  </div>
                </div>
              ))
            )}

            {/* ===== PLEASE NOTE ===== */}
            {noteItems.length > 0 && (
              <div className="row" style={{ paddingTop: '6pt', paddingBottom: '6pt' }}>
                <div className="row-label">Please<br />Note</div>
                <div className="row-content" style={{ fontSize: '9pt', lineHeight: 1.4 }}>
                  {noteItems.map((note, i) => (
                    <div key={i} style={{ padding: '1pt 0' }}>{note}</div>
                  ))}
                </div>
                <div />
              </div>
            )}

            {/* ===== STANDARD HOURLY RATES ===== */}
            {rateList.length > 0 && (
              <div className="row rates-row row-last">
                <div className="row-label">Standard<br />Hourly Rates<br /><span style={{ letterSpacing: '0.12em' }}>(ex GST)</span></div>
                <div className="row-content">
                  {rateList.map((r: any) => (
                    <Fragment key={r.label}>
                      <div>{r.label}</div>
                      <div className="rate-amt">{formatCurrency(r.hourly_rate)}</div>
                    </Fragment>
                  ))}
                </div>
                <div />
              </div>
            )}

            {/* ===== PROPOSED FEE BOX ===== */}
            <div className="fee-row">
              <div className="fee-label-col">
                Proposed Fee
                <span className="sub">(ex GST)</span>
              </div>
              <div className="fee-box">
                <div className="fee-amount-line">
                  <span className="fee-amount">{formatCurrency(q.subtotal)}</span>
                  <span className="fee-ex">ex GST</span>
                  <span className="fee-valid">({validText})</span>
                </div>
                <div className="fee-terms">Payment due within 14 days upon request</div>
              </div>
            </div>

          </div>

          {/* ===== SIGN-OFF ===== */}
          <div className="signoff">
            <div className="signoff-line">Should you require any additional information please do not hesitate to contact me.</div>
            <div className="signoff-regards">Kind Regards</div>
            <div className="sig-script">Mitch Warwick</div>
            <div className="sig-name">Mitch Warwick</div>
            <div className="sig-role">Registered Surveyor</div>
            <div className="sig-reg">Surveyor Registered under the Surveying and Spatial Information Act 2002</div>

            {q.notes && (
              <div style={{ marginTop: '14pt', fontSize: '8.5pt', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {q.notes}
              </div>
            )}
          </div>

          {/* ===== DARK BOTTOM BAR ===== */}
          <div className="bottom-bar">
            <div>Page 1 of 1</div>
            <div className="right">
              <span className="web">{website}</span>
              <span className="div" />
              <span className="abn">ABN {abn}</span>
              <span className="accent" />
            </div>
          </div>

      </div>
    </>
  )
}
