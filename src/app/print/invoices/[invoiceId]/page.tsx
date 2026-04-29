import React from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { PrintBar } from '@/app/print/print-bar'
import { fetchTaskPosForInvoice, type TaskPo } from '@/lib/utils/invoice-pos'

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>
}) {
  const { invoiceId } = await params
  const supabase = await createClient()
  const db = supabase as any

  const [{ data: invoice }, itemsResult, { data: settingsRows }, { data: roleRows }] = await Promise.all([
    db
      .from('invoices')
      .select(`
        id, invoice_number, status,
        subtotal, gst_amount, total,
        due_date, sent_at, paid_at, created_at, notes,
        quotes ( quote_number, contact_name, contact_email, contact_phone,
                 site_address, suburb, clients ( name, company_name ) ),
        projects ( id, invoice_layout, invoice_show_entry_details )
      `)
      .eq('id', invoiceId)
      .single(),
    // Try extended query first
    db
      .from('invoice_items')
      .select(`
        id, description, quantity, unit_price, amount, sort_order, is_variation,
        task_id, prev_claimed_amount,
        project_tasks ( title, fee_type, quoted_amount, quotes!quote_id ( quote_number ) ),
        time_entries!time_entry_id ( date, acting_role, staff_profiles!staff_id ( full_name, role ) )
      `)
      .eq('invoice_id', invoiceId)
      .order('sort_order'),
    db.from('company_settings').select('key, value'),
    db.from('role_rates').select('role_key, label'),
  ])

  if (!invoice) notFound()

  // Fall back to simple query if extended fails (migration not yet run)
  let items = itemsResult.data
  if (itemsResult.error || !items) {
    const fallback = await db
      .from('invoice_items')
      .select('id, description, quantity, unit_price, amount, sort_order')
      .eq('invoice_id', invoiceId)
      .order('sort_order')
    items = fallback.data
  }

  const inv      = invoice as any
  const q        = inv.quotes as any | null
  const itemList = (items ?? []) as any[]

  // POs that authorise tasks on this invoice
  const projectIdForPos = inv.projects?.id
  const invoiceTaskIds  = Array.from(
    new Set(itemList.map(i => i.task_id).filter((id): id is string => !!id))
  )
  const taskPoMap: Map<string, TaskPo[]> = projectIdForPos
    ? await fetchTaskPosForInvoice(db, projectIdForPos, invoiceTaskIds)
    : new Map()

  const settings: Record<string, string> = {}
  for (const row of (settingsRows ?? [])) settings[row.key] = row.value

  const roleLabelMap: Record<string, string> = {}
  for (const r of (roleRows ?? [])) roleLabelMap[r.role_key] = r.label

  // Effective role for an invoice item's source time entry: acting_role overrides staff default.
  const itemRoleLabel = (item: any): string => {
    const te = item.time_entries
    if (!te) return '—'
    const key = te.acting_role ?? te.staff_profiles?.role ?? ''
    return roleLabelMap[key] ?? '—'
  }

  const companyName = settings.company_name || 'Delfs Lascelles Consulting Surveyors'
  const abn         = settings.abn || ''
  const bankName    = settings.bank_name || ''
  const bsb         = settings.bsb || ''
  const accountNum  = settings.account_number || ''
  const accountName = settings.account_name || ''

  const invoiceLayout: 'role_grouped' | 'per_line' = (inv.projects?.invoice_layout ?? 'role_grouped')
  const showEntryDetails: boolean = !!inv.projects?.invoice_show_entry_details

  const clientName  = q?.clients?.company_name ?? q?.clients?.name ?? null
  const contactName = q?.contact_name ?? null
  const contactEmail = q?.contact_email ?? null

  // Group items by task (same logic as detail page)
  type Group = {
    key: string
    title: string
    feeType: 'fixed' | 'hourly' | null
    quoted: number
    prevClaimed: number
    thisClaim: number
    remaining: number
    claimLabel?: 'Progress Claim' | 'Final Claim'
    quoteNumber?: string | null
    pos: TaskPo[]
    rows: typeof itemList
  }

  const hasTaskData = itemList.some(i => i.task_id != null)
  const groupMap = new Map<string, Group>()

  for (const item of itemList) {
    const key     = item.task_id ?? `__item_${item.id}`
    const feeType = (item.project_tasks?.fee_type ?? null) as 'fixed' | 'hourly' | null

    if (!groupMap.has(key)) {
      const quoted      = item.project_tasks?.quoted_amount ?? 0
      const prevClaimed = item.prev_claimed_amount ?? 0
      // Only the non-variation fixed-fee row anchors `thisClaim`.
      const thisClaim   = feeType === 'fixed' && !item.is_variation ? (item.amount ?? item.unit_price) : 0
      const remaining   = Math.max(0, quoted - prevClaimed - thisClaim)
      const taskQuotes = item.project_tasks?.quotes
      const quoteNumber = (Array.isArray(taskQuotes) ? taskQuotes[0]?.quote_number : taskQuotes?.quote_number) ?? null
      groupMap.set(key, {
        key,
        title:      item.project_tasks?.title ?? item.description,
        feeType,
        quoted,
        prevClaimed,
        thisClaim,
        remaining,
        claimLabel: feeType === 'fixed' && hasTaskData
          ? (remaining <= 0.005 ? 'Final Claim' : 'Progress Claim')
          : undefined,
        quoteNumber,
        pos: item.task_id ? (taskPoMap.get(item.task_id) ?? []) : [],
        rows: [],
      })
    }
    const g = groupMap.get(key)!
    if (feeType === 'fixed' && !item.is_variation && (g.thisClaim ?? 0) === 0) {
      g.thisClaim = item.amount ?? item.unit_price
      g.remaining = Math.max(0, (g.quoted ?? 0) - (g.prevClaimed ?? 0) - g.thisClaim)
      if (hasTaskData) {
        g.claimLabel = g.remaining <= 0.005 ? 'Final Claim' : 'Progress Claim'
      }
    }
    g.rows.push(item)
  }

  const groups = Array.from(groupMap.values())

  return (
    <>
      <title>{`${inv.invoice_number} — Tax Invoice`}</title>
      <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 10pt; color: #1e293b; background: white; }
          .page { max-width: 210mm; margin: 0 auto; padding: 20mm 20mm 15mm 20mm; min-height: 297mm; }

          /* Header */
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16pt; }
          .company-name { font-size: 16pt; font-weight: bold; color: #1e293b; }
          .company-sub  { font-size: 9pt; color: #64748b; margin-top: 2pt; }
          .header-right { text-align: right; font-size: 9pt; line-height: 1.7; color: #475569; }
          .header-right strong { font-weight: 600; color: #1e293b; }
          .divider { border: none; border-top: 1.5pt solid #cbd5e1; margin-bottom: 16pt; }
          h1 { font-size: 22pt; font-weight: bold; color: #1e293b; margin-bottom: 14pt; }

          /* Bill To */
          .bill-block { margin-bottom: 18pt; font-size: 10pt; line-height: 1.6; }
          .label { font-size: 8.5pt; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; margin-bottom: 3pt; }

          /* Task sections */
          .task-section { margin-bottom: 14pt; border: 0.75pt solid #e2e8f0; border-radius: 3pt; overflow: hidden; }
          .task-header  { display: flex; justify-content: space-between; align-items: center;
                          padding: 7pt 10pt; background: #f8fafc; border-bottom: 0.75pt solid #e2e8f0; }
          .task-title   { font-size: 10pt; font-weight: bold; color: #1e293b; display: flex; align-items: baseline; gap: 10pt; }
          .task-quote-ref { font-size: 8.5pt; font-weight: normal; color: #64748b; letter-spacing: 0.02em; }
          .claim-badge  { font-size: 7.5pt; font-weight: bold; letter-spacing: 0.05em;
                          text-transform: uppercase; padding: 2pt 7pt; border-radius: 10pt; }
          .badge-progress { background: #fef3c7; color: #92400e; }
          .badge-final    { background: #dcfce7; color: #166534; }

          /* Fixed fee breakdown */
          .fixed-breakdown { padding: 0 10pt; }
          .fixed-row { display: flex; justify-content: space-between; padding: 5pt 0;
                       border-bottom: 0.5pt solid #f1f5f9; font-size: 9.5pt; }
          .fixed-row:last-child { border-bottom: none; }
          .fixed-label { color: #64748b; }
          .fixed-value { font-weight: 600; color: #1e293b; }
          .fixed-row.this-claim { padding: 7pt 0; border-top: 0.75pt solid #cbd5e1;
                                  border-bottom: 0.75pt solid #cbd5e1; font-size: 10.5pt; }
          .fixed-row.this-claim .fixed-label { color: #1e293b; font-weight: bold; }
          .fixed-row.remaining .fixed-value  { color: #15803d; }

          /* Variation block (under fixed fee) */
          .variation-title { padding: 7pt 10pt 3pt; font-size: 8pt; font-weight: bold; letter-spacing: 0.06em;
                             text-transform: uppercase; color: #92400e; border-top: 0.75pt solid #fcd34d;
                             background: #fffbeb; display: flex; justify-content: space-between; align-items: baseline; gap: 10pt; }
          .variation-title .quote-ref { font-weight: normal; color: #92400e; opacity: 0.75; text-transform: none; letter-spacing: 0.02em; }

          /* Hourly table */
          .hourly-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
          .hourly-table th { font-size: 7.5pt; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase;
                             color: #94a3b8; border-bottom: 0.5pt solid #cbd5e1; padding: 5pt 8pt; text-align: left; }
          .hourly-table th.right, .hourly-table td.right { text-align: right; }
          .hourly-table td { padding: 5pt 8pt; border-bottom: 0.5pt solid #f1f5f9; color: #334155; }
          .hourly-table td.amount { font-weight: 600; color: #1e293b; }

          /* Role-grouped layout */
          .hourly-table.role-grouped tr.role-row td { padding: 6pt 8pt; border-bottom: 0.5pt solid #cbd5e1; font-size: 10pt; }
          .hourly-table.role-grouped tr.role-row td.role-label { font-style: italic; color: #1e293b; }
          .hourly-table.role-grouped tr.detail-row td { border-bottom: none; padding: 2pt 8pt; font-size: 9pt; color: #475569; }
          .hourly-table.role-grouped tr.detail-row td.detail-hrs  { color: #64748b; }
          .hourly-table.role-grouped tr.detail-row .detail-date { color: #64748b; padding-left: 18pt; padding-right: 12pt; white-space: nowrap; }
          .hourly-table.role-grouped tr.detail-row .detail-desc { color: #475569; }

          /* Simple item (old invoices without task data) */
          .simple-item { display: flex; justify-content: space-between; padding: 8pt 10pt; font-size: 10pt; }
          .simple-item .desc { color: #1e293b; }
          .simple-item .amt  { font-weight: 600; }

          /* Totals */
          .totals { margin-top: 12pt; display: flex; flex-direction: column; align-items: flex-end; gap: 3pt; }
          .totals-row { display: flex; gap: 40pt; font-size: 9.5pt; }
          .totals-row span:last-child { min-width: 80pt; text-align: right; }
          .total-final { display: flex; gap: 40pt; font-size: 13pt; font-weight: bold;
                         border-top: 1.5pt solid #1e293b; padding-top: 6pt; margin-top: 4pt; }
          .total-final span:last-child { min-width: 80pt; text-align: right; }

          /* Payment block */
          .payment-block { margin-top: 24pt; padding: 12pt; background: #f8fafc;
                           border: 0.75pt solid #e2e8f0; border-radius: 3pt; }
          .payment-title { font-size: 9pt; font-weight: bold; text-transform: uppercase;
                           letter-spacing: 0.06em; color: #64748b; margin-bottom: 6pt; }
          .payment-row   { font-size: 9.5pt; line-height: 1.8; }
          .payment-ref   { font-size: 8.5pt; color: #94a3b8; margin-top: 4pt; }

          .notes-block { margin-top: 16pt; }
          .footer { border-top: 0.75pt solid #e2e8f0; padding-top: 10pt; margin-top: 24pt;
                    font-size: 9pt; color: #64748b; }

          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .page { padding: 15mm 18mm 12mm 18mm; }
            .no-print { display: none !important; }
          }
        `}</style>

      <PrintBar />

      <div className="page">

          {/* Header */}
          <div className="header">
            <div>
              <div className="company-name">{companyName}</div>
              {abn && <div className="company-sub">ABN: {abn}</div>}
            </div>
            <div className="header-right">
              <div><strong>Invoice #:</strong> {inv.invoice_number}</div>
              <div><strong>Date:</strong> {formatDate(inv.created_at)}</div>
              {inv.due_date && <div><strong>Due:</strong> {formatDate(inv.due_date)}</div>}
              {contactEmail && <div><strong>To:</strong> {contactEmail}</div>}
            </div>
          </div>

          <hr className="divider" />

          <h1>Tax Invoice</h1>

          {/* Bill To */}
          {(contactName || clientName) && (
            <div className="bill-block">
              <div className="label">Bill To</div>
              {contactName && <div><strong>{contactName}</strong></div>}
              {clientName && <div>{clientName}</div>}
              {q?.site_address && (
                <div style={{ color: '#64748b', fontSize: '9pt' }}>
                  {[q.site_address, q.suburb].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Task sections */}
          {groups.map(group => (
            <div key={group.key} className="task-section">

              {/* Section header */}
              <div className="task-header">
                <div className="task-title">
                  <div>
                    {group.title}
                    {group.quoteNumber && (
                      <span className="task-quote-ref" style={{ marginLeft: '10pt' }}>Quote #: {group.quoteNumber}</span>
                    )}
                    {group.pos.length > 0 && (
                      <div className="task-quote-ref" style={{ marginTop: '2pt' }}>
                        PO: {group.pos.map(p => p.po_number).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                {group.claimLabel && (
                  <div className={`claim-badge ${group.claimLabel === 'Final Claim' ? 'badge-final' : 'badge-progress'}`}>
                    {group.claimLabel}
                  </div>
                )}
              </div>

              {/* Fixed fee — vertical breakdown */}
              {group.feeType === 'fixed' && hasTaskData && (
                <div className="fixed-breakdown">
                  <div className="fixed-row">
                    <span className="fixed-label">Quoted (Fixed Fee)</span>
                    <span className="fixed-value">{formatCurrency(group.quoted)}</span>
                  </div>
                  <div className="fixed-row">
                    <span className="fixed-label">Previously Claimed</span>
                    <span className="fixed-value">{formatCurrency(group.prevClaimed)}</span>
                  </div>
                  <div className="fixed-row this-claim">
                    <span className="fixed-label">This Claim</span>
                    <span className="fixed-value">{formatCurrency(group.thisClaim)}</span>
                  </div>
                  <div className={`fixed-row remaining`}>
                    <span className="fixed-label">Remaining After This Claim</span>
                    <span className="fixed-value" style={{ color: group.remaining <= 0.005 ? '#15803d' : '#1e293b' }}>
                      {formatCurrency(group.remaining)}
                    </span>
                  </div>
                </div>
              )}

              {/* Variations on a fixed-fee task — billed hourly under the fixed fee */}
              {group.feeType === 'fixed' && hasTaskData && group.rows.some((i: any) => i.is_variation) && (() => {
                const variationRows = group.rows.filter((i: any) => i.is_variation)
                if (invoiceLayout === 'per_line') {
                  return (
                    <>
                      <div className="variation-title">
                        <span>Variations to Fixed Fee</span>
                        {group.quoteNumber && <span className="quote-ref">Quote #: {group.quoteNumber}</span>}
                      </div>
                      <table className="hourly-table">
                        <thead>
                          <tr>
                            <th style={{ width: '62pt' }}>Date</th>
                            <th style={{ width: '120pt' }}>Role</th>
                            <th>Description</th>
                            <th className="right" style={{ width: '42pt' }}>Hrs</th>
                            <th className="right" style={{ width: '62pt' }}>Rate</th>
                            <th className="right" style={{ width: '68pt' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variationRows.map((item: any) => (
                            <tr key={item.id}>
                              <td>{item.time_entries?.date ? formatDate(item.time_entries.date) : '—'}</td>
                              <td>{itemRoleLabel(item)}</td>
                              <td>{item.description}</td>
                              <td className="right">{item.quantity}</td>
                              <td className="right">{formatCurrency(item.unit_price)}/h</td>
                              <td className="right amount">{formatCurrency(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )
                }
                // role_grouped
                type RG = { roleLabel: string; hours: number; amount: number; rows: any[] }
                const groupsByRole = new Map<string, RG>()
                for (const item of variationRows) {
                  const label = itemRoleLabel(item)
                  const rg = groupsByRole.get(label) ?? { roleLabel: label, hours: 0, amount: 0, rows: [] }
                  rg.hours  += Number(item.quantity)
                  rg.amount += Number(item.amount)
                  rg.rows.push(item)
                  groupsByRole.set(label, rg)
                }
                return (
                  <>
                    <div className="variation-title">Variations to Fixed Fee</div>
                    <table className="hourly-table role-grouped">
                      <tbody>
                        {Array.from(groupsByRole.values()).map((rg, gi) => {
                          const effRate = rg.hours > 0 ? rg.amount / rg.hours : 0
                          return (
                            <React.Fragment key={gi}>
                              <tr className="role-row">
                                <td className="role-label" colSpan={2}>{rg.roleLabel}</td>
                                <td className="right">{rg.hours.toFixed(2)}</td>
                                <td className="right">{formatCurrency(effRate)}/h</td>
                                <td className="right amount">{formatCurrency(rg.amount)}</td>
                              </tr>
                              {showEntryDetails && rg.rows.map((item: any) => (
                                <tr key={item.id} className="detail-row">
                                  <td colSpan={2}>
                                    <span className="detail-date">{item.time_entries?.date ? formatDate(item.time_entries.date) : '—'}</span>
                                    <span className="detail-desc">{item.description}</span>
                                  </td>
                                  <td className="right detail-hrs">{Number(item.quantity).toFixed(2)}</td>
                                  <td></td>
                                  <td></td>
                                </tr>
                              ))}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </>
                )
              })()}

              {/* Fixed fee — simple (old invoices, no task data) */}
              {(group.feeType === 'fixed' || !group.feeType) && !hasTaskData && (
                <div className="simple-item">
                  <span className="desc">{group.rows[0]?.description}</span>
                  <span className="amt">{formatCurrency(group.rows[0]?.amount ?? 0)}</span>
                </div>
              )}

              {/* Hourly — per-line layout */}
              {group.feeType === 'hourly' && invoiceLayout === 'per_line' && (
                <table className="hourly-table">
                  <thead>
                    <tr>
                      <th style={{ width: '62pt' }}>Date</th>
                      <th style={{ width: '120pt' }}>Role</th>
                      <th>Description</th>
                      <th className="right" style={{ width: '42pt' }}>Hrs</th>
                      <th className="right" style={{ width: '62pt' }}>Rate</th>
                      <th className="right" style={{ width: '68pt' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((item: any) => {
                      const isAdjustment = !item.time_entries
                      if (isAdjustment) {
                        return (
                          <tr key={item.id}>
                            <td colSpan={5} style={{ fontStyle: 'italic', color: '#475569' }}>{item.description}</td>
                            <td className="right amount">{formatCurrency(item.amount)}</td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={item.id}>
                          <td>{item.time_entries?.date ? formatDate(item.time_entries.date) : '—'}</td>
                          <td>{itemRoleLabel(item)}</td>
                          <td>{item.description}</td>
                          <td className="right">{item.quantity}</td>
                          <td className="right">{formatCurrency(item.unit_price)}/h</td>
                          <td className="right amount">{formatCurrency(item.amount)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* Hourly — role-grouped layout */}
              {group.feeType === 'hourly' && invoiceLayout === 'role_grouped' && (() => {
                type RG = { roleLabel: string; hours: number; amount: number; rows: any[] }
                const groupsByRole = new Map<string, RG>()
                const adjustmentRows: any[] = []
                for (const item of group.rows) {
                  if (!item.time_entries) {
                    adjustmentRows.push(item)
                    continue
                  }
                  const label = itemRoleLabel(item)
                  const g = groupsByRole.get(label) ?? { roleLabel: label, hours: 0, amount: 0, rows: [] }
                  g.hours  += Number(item.quantity)
                  g.amount += Number(item.amount)
                  g.rows.push(item)
                  groupsByRole.set(label, g)
                }
                return (
                  <table className="hourly-table role-grouped">
                    <tbody>
                      {Array.from(groupsByRole.values()).map((g, gi) => {
                        const effRate = g.hours > 0 ? g.amount / g.hours : 0
                        return (
                          <React.Fragment key={gi}>
                            <tr className="role-row">
                              <td className="role-label" colSpan={2}>{g.roleLabel}</td>
                              <td className="right">{g.hours.toFixed(2)}</td>
                              <td className="right">{formatCurrency(effRate)}/h</td>
                              <td className="right amount">{formatCurrency(g.amount)}</td>
                            </tr>
                            {showEntryDetails && g.rows.map((item: any) => (
                              <tr key={item.id} className="detail-row">
                                <td colSpan={2}>
                                  <span className="detail-date">{item.time_entries?.date ? formatDate(item.time_entries.date) : '—'}</span>
                                  <span className="detail-desc">{item.description}</span>
                                </td>
                                <td className="right detail-hrs">{Number(item.quantity).toFixed(2)}</td>
                                <td></td>
                                <td></td>
                              </tr>
                            ))}
                          </React.Fragment>
                        )
                      })}
                      {adjustmentRows.map((item: any) => (
                        <tr key={item.id} className="role-row">
                          <td className="role-label" colSpan={4} style={{ fontStyle: 'italic', color: '#475569' }}>{item.description}</td>
                          <td className="right amount">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          ))}

          {/* Totals */}
          <div className="totals">
            <div className="totals-row">
              <span style={{ color: '#64748b' }}>Subtotal (ex GST)</span>
              <span>{formatCurrency(inv.subtotal)}</span>
            </div>
            <div className="totals-row">
              <span style={{ color: '#64748b' }}>GST (10%)</span>
              <span>{formatCurrency(inv.gst_amount)}</span>
            </div>
            <div className="total-final">
              <span>Total</span>
              <span>{formatCurrency(inv.total)}</span>
            </div>
          </div>

          {/* Payment details */}
          <div className="payment-block">
            <div className="payment-title">Payment Details</div>
            <div className="payment-row">
              <div>Please pay within 14 days of invoice date.</div>
              {(bankName || bsb || accountNum) && (
                <div style={{ marginTop: '4pt' }}>
                  {bankName && <><strong>Bank:</strong> {bankName} &nbsp;</>}
                  {bsb && <><strong>BSB:</strong> {bsb} &nbsp;</>}
                  {accountNum && <><strong>Account:</strong> {accountNum} &nbsp;</>}
                  {accountName && <><strong>Name:</strong> {accountName}</>}
                </div>
              )}
            </div>
            <div className="payment-ref">Reference {inv.invoice_number} when paying.</div>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div className="notes-block">
              <div className="label">Notes</div>
              <div style={{ fontSize: '9.5pt', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: '4pt' }}>
                {inv.notes}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="footer">
            <div>{companyName}{abn ? ` — ABN: ${abn}` : ''}</div>
          </div>

      </div>
    </>
  )
}
