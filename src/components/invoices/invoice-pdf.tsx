import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
    paddingTop: 48,
    paddingBottom: 48,
    paddingLeft: 56,
    paddingRight: 56,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  companySub: { fontSize: 9, color: '#64748b', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerRightRow: { fontSize: 9, color: '#475569', marginBottom: 2 },
  headerRightBold: { fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  divider: { borderBottomWidth: 1.5, borderBottomColor: '#cbd5e1', marginBottom: 16 },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 14 },
  billBlock: { marginBottom: 14 },
  label: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  billName: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  billDetail: { fontSize: 9, color: '#475569', marginTop: 1 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, marginTop: 14, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', paddingBottom: 3 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionQuoteRef: { fontSize: 8.5, color: '#94a3b8' },
  variationTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#fcd34d' },
  variationTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#92400e', letterSpacing: 0.5, textTransform: 'uppercase' },
  variationQuoteRef: { fontSize: 8, color: '#92400e' },
  // Fixed fee breakdown — vertical layout
  claimBadge:        { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3, marginBottom: 8 },
  claimBadgeText:    { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  fixedBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  fixedBreakdownLabel: { fontSize: 9, color: '#64748b' },
  fixedBreakdownValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  fixedBreakdownDivider: { borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginVertical: 2 },
  fixedThisClaimRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  fixedThisClaimLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  fixedThisClaimValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  // Hourly table
  tableHeader: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1', paddingBottom: 3, marginBottom: 2 },
  tableHeaderCell: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', paddingVertical: 3 },
  tableCell: { fontSize: 9, color: '#334155' },
  colDate:   { width: 55 },
  colStaff:  { width: 110 },
  colDesc:   { flex: 1, paddingRight: 8 },
  colHours:  { width: 40, textAlign: 'right' },
  colRate:   { width: 52, textAlign: 'right' },
  colAmt:    { width: 60, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  // Role-grouped layout
  roleGroupRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1', paddingVertical: 4, marginTop: 4 },
  roleGroupLabel: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Oblique', color: '#1e293b' },
  roleGroupHours: { width: 50, fontSize: 10, color: '#334155', textAlign: 'right' },
  roleGroupRate:  { width: 70, fontSize: 10, color: '#334155', textAlign: 'right' },
  roleGroupAmt:   { width: 75, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e293b', textAlign: 'right' },
  detailRow: { flexDirection: 'row', paddingVertical: 2, paddingLeft: 12 },
  detailDate: { width: 60, fontSize: 9, color: '#64748b' },
  detailDesc: { flex: 1, fontSize: 9, color: '#475569', paddingRight: 8 },
  detailHrs:  { width: 50, fontSize: 9, color: '#64748b', textAlign: 'right' },
  detailRateSpacer: { width: 70 },
  detailAmtSpacer:  { width: 75 },
  // Adjustment row (rounding etc) — full-width label + amount under role groups
  adjustmentRow:    { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1', paddingVertical: 4, marginTop: 4 },
  adjustmentLabel:  { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Oblique', color: '#475569' },
  adjustmentAmt:    { width: 75, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e293b', textAlign: 'right' },
  // Totals
  totalsBlock: { marginTop: 20, alignItems: 'flex-end' },
  totalsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  totalsLabel: { fontSize: 9, color: '#64748b', width: 130, textAlign: 'right', paddingRight: 16 },
  totalsValue: { fontSize: 9, width: 70, textAlign: 'right' },
  totalsFinalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, paddingTop: 4, borderTopWidth: 1.5, borderTopColor: '#1e293b' },
  totalsFinalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', width: 130, textAlign: 'right', paddingRight: 16 },
  totalsFinalValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', width: 70, textAlign: 'right' },
  // Payment block
  paymentBlock: { marginTop: 20, padding: 10, backgroundColor: '#f8fafc', borderWidth: 0.75, borderColor: '#e2e8f0' },
  paymentTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  paymentText: { fontSize: 9, color: '#334155', lineHeight: 1.6 },
  notesBlock: { marginTop: 14 },
  footer: { marginTop: 24, paddingTop: 8, borderTopWidth: 0.75, borderTopColor: '#e2e8f0' },
  footerText: { fontSize: 8.5, color: '#64748b' },
})

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

function fmtDate(s: string) {
  if (!s) return ''
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export interface TaskSection {
  taskId: string
  taskTitle: string
  feeType: 'fixed' | 'hourly'
  claimLabel?: 'Progress Claim' | 'Final Claim'
  quoteNumber?: string | null
  pos?: { po_number: string; amount: number | null }[]
  // Fixed fee
  quotedAmount?: number
  prevClaimed?: number
  thisClaim?: number
  // Hourly
  entries?: HourlyEntry[]
  // Variation-to-fixed-fee entries — only present on fixed-fee sections; rendered as an hourly table below the breakdown.
  variationEntries?: HourlyEntry[]
  // Section-level adjustment line items (e.g. rounding) — no time entry, displayed below the role groups.
  adjustments?: {
    description: string
    amount: number
  }[]
}

export interface HourlyEntry {
  date: string
  roleLabel: string
  description: string
  hours: number
  rate: number
  amount: number
}

interface HourlyTableProps {
  entries: HourlyEntry[]
  layout: 'role_grouped' | 'per_line'
  showEntryDetails: boolean
  adjustments?: { description: string; amount: number }[]
}

function HourlyTable({ entries, layout, showEntryDetails, adjustments }: HourlyTableProps) {
  if (entries.length === 0) return null
  if (layout === 'per_line') {
    return (
      <View>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
          <Text style={[styles.tableHeaderCell, styles.colStaff]}>Role</Text>
          <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
          <Text style={[styles.tableHeaderCell, styles.colHours]}>Hrs</Text>
          <Text style={[styles.tableHeaderCell, styles.colRate]}>Rate</Text>
          <Text style={[styles.tableHeaderCell, styles.colAmt]}>Amount</Text>
        </View>
        {entries.map((entry, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.colDate]}>{fmtDate(entry.date)}</Text>
            <Text style={[styles.tableCell, styles.colStaff]}>{entry.roleLabel}</Text>
            <Text style={[styles.tableCell, styles.colDesc]}>{entry.description}</Text>
            <Text style={[styles.tableCell, styles.colHours]}>{entry.hours.toFixed(2)}</Text>
            <Text style={[styles.tableCell, styles.colRate]}>{fmt(entry.rate)}/h</Text>
            <Text style={[styles.tableCell, styles.colAmt]}>{fmt(entry.amount)}</Text>
          </View>
        ))}
        {(adjustments ?? []).map((adj, i) => (
          <View key={`adj-${i}`} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1, fontFamily: 'Helvetica-Oblique', color: '#475569' }]}>{adj.description}</Text>
            <Text style={[styles.tableCell, styles.colAmt]}>{fmt(adj.amount)}</Text>
          </View>
        ))}
      </View>
    )
  }
  // role_grouped
  type Group = { roleLabel: string; hours: number; amount: number; entries: HourlyEntry[] }
  const groups = new Map<string, Group>()
  for (const e of entries) {
    const g = groups.get(e.roleLabel) ?? { roleLabel: e.roleLabel, hours: 0, amount: 0, entries: [] }
    g.hours += e.hours
    g.amount += e.amount
    g.entries.push(e)
    groups.set(e.roleLabel, g)
  }
  return (
    <View>
      {Array.from(groups.values()).map((g, gi) => {
        const effRate = g.hours > 0 ? g.amount / g.hours : 0
        return (
          <View key={gi}>
            <View style={styles.roleGroupRow}>
              <Text style={styles.roleGroupLabel}>{g.roleLabel}</Text>
              <Text style={styles.roleGroupHours}>{g.hours.toFixed(2)}</Text>
              <Text style={styles.roleGroupRate}>{fmt(effRate)}/h</Text>
              <Text style={styles.roleGroupAmt}>{fmt(g.amount)}</Text>
            </View>
            {showEntryDetails && g.entries.map((entry, i) => (
              <View key={i} style={styles.detailRow}>
                <Text style={styles.detailDate}>{fmtDate(entry.date)}</Text>
                <Text style={styles.detailDesc}>{entry.description}</Text>
                <Text style={styles.detailHrs}>{entry.hours.toFixed(2)}</Text>
                <Text style={styles.detailRateSpacer}> </Text>
                <Text style={styles.detailAmtSpacer}> </Text>
              </View>
            ))}
          </View>
        )
      })}
      {(adjustments ?? []).map((adj, i) => (
        <View key={`adj-${i}`} style={styles.adjustmentRow}>
          <Text style={styles.adjustmentLabel}>{adj.description}</Text>
          <Text style={styles.adjustmentAmt}>{fmt(adj.amount)}</Text>
        </View>
      ))}
    </View>
  )
}

export interface InvoicePDFProps {
  invoiceNumber: string
  createdAt: string
  dueDate: string | null
  subtotal: number
  gstAmount: number
  total: number
  notes: string | null
  contactName: string | null
  contactEmail: string | null
  projectTitle: string
  clientName: string | null
  taskSections: TaskSection[]
  invoiceLayout: 'role_grouped' | 'per_line'
  showEntryDetails: boolean
  companyName: string
  abn: string
  bankName: string
  bsb: string
  accountNumber: string
  accountName: string
}

export function InvoicePDFDocument(props: InvoicePDFProps) {
  const {
    invoiceNumber, createdAt, dueDate, subtotal, gstAmount, total,
    notes, contactName, contactEmail, projectTitle, clientName, taskSections,
    invoiceLayout, showEntryDetails,
    companyName, abn, bankName, bsb, accountNumber, accountName,
  } = props

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{companyName}</Text>
            {abn ? <Text style={styles.companySub}>ABN: {abn}</Text> : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerRightRow}>
              <Text style={styles.headerRightBold}>Invoice #: </Text>{invoiceNumber}
            </Text>
            <Text style={styles.headerRightRow}>
              <Text style={styles.headerRightBold}>Date: </Text>{fmtDate(createdAt)}
            </Text>
            {dueDate && (
              <Text style={styles.headerRightRow}>
                <Text style={styles.headerRightBold}>Due: </Text>{fmtDate(dueDate)}
              </Text>
            )}
            {contactEmail && (
              <Text style={styles.headerRightRow}>
                <Text style={styles.headerRightBold}>To: </Text>{contactEmail}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>Tax Invoice</Text>

        {/* Bill To */}
        {(contactName || clientName) && (
          <View style={styles.billBlock}>
            <Text style={styles.label}>Bill To</Text>
            {contactName && <Text style={styles.billName}>{contactName}</Text>}
            {clientName && <Text style={styles.billDetail}>{clientName}</Text>}
            {projectTitle && <Text style={styles.billDetail}>{projectTitle}</Text>}
          </View>
        )}

        {/* Task sections */}
        {taskSections.map((section) => (
          <View key={section.taskId}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{section.taskTitle}</Text>
              {section.quoteNumber && (
                <Text style={styles.sectionQuoteRef}>Quote #: {section.quoteNumber}</Text>
              )}
            </View>
            {section.pos && section.pos.length > 0 && (
              <Text style={styles.sectionQuoteRef}>
                PO: {section.pos.map(p => p.po_number).join(', ')}
              </Text>
            )}

            {section.feeType === 'fixed' && (() => {
              const remaining = Math.max(0,
                (section.quotedAmount ?? 0) - (section.prevClaimed ?? 0) - (section.thisClaim ?? 0)
              )
              const isFinal = (section.claimLabel === 'Final Claim')
              return (
                <View>
                  {/* Claim type badge */}
                  <View style={[
                    styles.claimBadge,
                    { backgroundColor: isFinal ? '#dcfce7' : '#fef3c7' },
                  ]}>
                    <Text style={[
                      styles.claimBadgeText,
                      { color: isFinal ? '#166534' : '#92400e' },
                    ]}>
                      {section.claimLabel ?? 'Progress Claim'}
                    </Text>
                  </View>

                  {/* Breakdown rows */}
                  <View style={styles.fixedBreakdownRow}>
                    <Text style={styles.fixedBreakdownLabel}>Quoted (Fixed Fee)</Text>
                    <Text style={styles.fixedBreakdownValue}>{fmt(section.quotedAmount ?? 0)}</Text>
                  </View>
                  <View style={styles.fixedBreakdownRow}>
                    <Text style={styles.fixedBreakdownLabel}>Previously Claimed</Text>
                    <Text style={styles.fixedBreakdownValue}>{fmt(section.prevClaimed ?? 0)}</Text>
                  </View>
                  <View style={styles.fixedBreakdownDivider} />
                  <View style={styles.fixedThisClaimRow}>
                    <Text style={styles.fixedThisClaimLabel}>This Claim</Text>
                    <Text style={styles.fixedThisClaimValue}>{fmt(section.thisClaim ?? 0)}</Text>
                  </View>
                  <View style={styles.fixedBreakdownDivider} />
                  <View style={styles.fixedBreakdownRow}>
                    <Text style={styles.fixedBreakdownLabel}>Remaining After This Claim</Text>
                    <Text style={styles.fixedBreakdownValue}>{fmt(remaining)}</Text>
                  </View>
                </View>
              )
            })()}

            {section.feeType === 'hourly' && section.entries && section.entries.length > 0 && (
              <HourlyTable
                entries={section.entries}
                layout={invoiceLayout}
                showEntryDetails={showEntryDetails}
                adjustments={section.adjustments}
              />
            )}

            {section.feeType === 'fixed' && section.variationEntries && section.variationEntries.length > 0 && (
              <View>
                <View style={styles.variationTitleRow}>
                  <Text style={styles.variationTitle}>Variations to Fixed Fee</Text>
                  {section.quoteNumber && (
                    <Text style={styles.variationQuoteRef}>Quote #: {section.quoteNumber}</Text>
                  )}
                </View>
                <HourlyTable
                  entries={section.variationEntries}
                  layout={invoiceLayout}
                  showEntryDetails={showEntryDetails}
                />
              </View>
            )}
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal (ex GST)</Text>
            <Text style={styles.totalsValue}>{fmt(subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>GST (10%)</Text>
            <Text style={styles.totalsValue}>{fmt(gstAmount)}</Text>
          </View>
          <View style={styles.totalsFinalRow}>
            <Text style={styles.totalsFinalLabel}>Total</Text>
            <Text style={styles.totalsFinalValue}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Payment details */}
        <View style={styles.paymentBlock}>
          <Text style={styles.paymentTitle}>Payment Details</Text>
          <Text style={styles.paymentText}>Please pay within 14 days of invoice date.</Text>
          {(bankName || bsb || accountNumber) && (
            <Text style={styles.paymentText}>
              {[
                bankName && `Bank: ${bankName}`,
                bsb && `BSB: ${bsb}`,
                accountNumber && `Account: ${accountNumber}`,
                accountName && `Name: ${accountName}`,
              ].filter(Boolean).join('  ·  ')}
            </Text>
          )}
          <Text style={[styles.paymentText, { color: '#94a3b8', fontSize: 8, marginTop: 3 }]}>
            Reference {invoiceNumber} when paying.
          </Text>
        </View>

        {/* Notes */}
        {notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.label}>Notes</Text>
            <Text style={{ fontSize: 9, color: '#334155', lineHeight: 1.5, marginTop: 3 }}>{notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {companyName}{abn ? ` · ABN: ${abn}` : ''}
          </Text>
        </View>

      </Page>
    </Document>
  )
}
