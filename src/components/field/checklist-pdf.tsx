import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface ChecklistPDFItem {
  text: string
  answer: 'yes' | 'no' | null
  comment: string
}

export interface ChecklistPDFProps {
  jobNumber:    string
  siteSpecific: string
  taskTitle:    string
  surveyorName: string
  templateTitle: string
  items:        ChecklistPDFItem[]
  visitDate:    string  // YYYY-MM-DD
  generatedAt:  string  // ISO
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1F1F22',
    paddingTop: 32,
    paddingBottom: 32,
    paddingLeft: 32,
    paddingRight: 32,
  },
  headerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  brand:      { fontSize: 12, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  brandSub:   { fontSize: 7, color: '#6B6B6F', letterSpacing: 1.2, marginTop: 1 },
  pageTitle:  { flex: 1, fontSize: 16, textAlign: 'center' },
  jobBox:     { borderWidth: 0.75, borderColor: '#000', marginBottom: 12 },
  jobRow:     { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000' },
  jobRowLast: { flexDirection: 'row' },
  jobCell:    { padding: 5, borderRightWidth: 0.5, borderRightColor: '#000', flex: 1 },
  jobCellLast:{ padding: 5, flex: 1 },
  jobLabel:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6B6B6F', textTransform: 'uppercase', letterSpacing: 0.5 },
  jobValue:   { fontSize: 10, marginTop: 2 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6, marginTop: 4 },
  // Items table
  itemsBox:        { borderWidth: 0.75, borderColor: '#000' },
  itemsHeaderRow:  { flexDirection: 'row', backgroundColor: '#EFEFEF', borderBottomWidth: 0.5, borderBottomColor: '#000' },
  itemsHeaderCell: { padding: 5, fontSize: 8, fontFamily: 'Helvetica-Bold', borderRightWidth: 0.5, borderRightColor: '#000' },
  itemsHeaderCellLast: { padding: 5, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  itemsRow:        { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000' },
  itemsRowLast:    { flexDirection: 'row' },
  itemCellNum:     { padding: 5, width: 24, borderRightWidth: 0.5, borderRightColor: '#000', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  itemCellText:    { padding: 5, flex: 3, borderRightWidth: 0.5, borderRightColor: '#000' },
  itemCellAnswer:  { padding: 5, width: 50, borderRightWidth: 0.5, borderRightColor: '#000', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  itemCellComment: { padding: 5, flex: 2 },
  answerYes:       { color: '#1F7A3F' },
  answerNo:        { color: '#A31D1D' },
  answerNone:      { color: '#9A9A9C' },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    fontSize: 7,
    color: '#6B6B6F',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function ChecklistPDFDocument({
  jobNumber, siteSpecific, taskTitle, surveyorName,
  templateTitle, items, visitDate, generatedAt,
}: ChecklistPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>DLCS</Text>
            <Text style={styles.brandSub}>FIELD CHECKLIST</Text>
          </View>
          <Text style={styles.pageTitle}>{templateTitle}</Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Job header */}
        <View style={styles.jobBox}>
          <View style={styles.jobRow}>
            <View style={styles.jobCell}>
              <Text style={styles.jobLabel}>Job Number</Text>
              <Text style={styles.jobValue}>{jobNumber}</Text>
            </View>
            <View style={styles.jobCell}>
              <Text style={styles.jobLabel}>Visit Date</Text>
              <Text style={styles.jobValue}>{visitDate}</Text>
            </View>
            <View style={styles.jobCellLast}>
              <Text style={styles.jobLabel}>Surveyor</Text>
              <Text style={styles.jobValue}>{surveyorName}</Text>
            </View>
          </View>
          <View style={styles.jobRowLast}>
            <View style={styles.jobCell}>
              <Text style={styles.jobLabel}>Site</Text>
              <Text style={styles.jobValue}>{siteSpecific || '—'}</Text>
            </View>
            <View style={styles.jobCellLast}>
              <Text style={styles.jobLabel}>Task</Text>
              <Text style={styles.jobValue}>{taskTitle || '—'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Checklist</Text>

        {/* Items */}
        <View style={styles.itemsBox}>
          <View style={styles.itemsHeaderRow}>
            <Text style={[styles.itemsHeaderCell, { width: 24, textAlign: 'center' }]}>#</Text>
            <Text style={[styles.itemsHeaderCell, { flex: 3 }]}>Item</Text>
            <Text style={[styles.itemsHeaderCell, { width: 50, textAlign: 'center' }]}>Answer</Text>
            <Text style={[styles.itemsHeaderCellLast, { flex: 2 }]}>Comments</Text>
          </View>
          {items.map((it, idx) => {
            const last = idx === items.length - 1
            const rowStyle = last ? styles.itemsRowLast : styles.itemsRow
            const answerLabel =
              it.answer === 'yes' ? 'YES'
              : it.answer === 'no' ? 'NO'
              : '—'
            const answerStyle =
              it.answer === 'yes' ? styles.answerYes
              : it.answer === 'no' ? styles.answerNo
              : styles.answerNone
            return (
              <View key={idx} style={rowStyle} wrap={false}>
                <Text style={styles.itemCellNum}>{idx + 1}</Text>
                <Text style={styles.itemCellText}>{it.text}</Text>
                <Text style={[styles.itemCellAnswer, answerStyle]}>{answerLabel}</Text>
                <Text style={styles.itemCellComment}>{it.comment || ''}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.footer} fixed>
          <Text>Submitted by {surveyorName}</Text>
          <Text>Generated {formatDate(generatedAt)}</Text>
        </View>
      </Page>
    </Document>
  )
}
