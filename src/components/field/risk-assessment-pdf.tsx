import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import {
  type RiskRating,
  type RiskBucket,
  rateRisk,
  BUCKET_COLORS,
} from './risk-matrix'

export interface AdditionalHazardRow {
  procedure:          string
  hazard:             string
  risk:               RiskRating | null
  control_measures:   string
  residual:           RiskRating | null
  person_responsible: string
}

// 25 SWMS tasks from DLCS Risk Assessment (matches jsa-form.tsx and the source PDF).
// Order is column-major (4 columns × 7 rows) to match the supplied template.
export const SWMS_TASKS: string[] = [
  'SWMS unsuitable for task',
  'Travel/Arrive work zones',
  'Vehicle access to and from work zone',
  'Working on or adjacent to roads (close to traffic)',
  'Entry to a Rail Corridor and Danger Zone',
  'Field survey – instrument setup, public area, electrical equipment checked',
  'Working around children',
  'Walking on site',
  'Using the visible laser distancer on Total Station',
  'Using spray marker/marker pens/hazardous substance',
  'Exposure to environmental elements',
  'Carrying out task in dense vegetation',
  'Working with hand tools',
  'Drone tasks',
  'Working with survey level staff',
  'Digging for sub-surface survey marks',
  'Working in open excavations',
  'Working near embankments and cuttings',
  'Removing access lids & covers',
  'Working with plant and heavy machinery',
  'Climate impact',
  'Working alongside waterways or in shallow waterways/creeks and ponds (including treatment plants)',
  'Contaminated sites',
  'Working alone or without communication',
  'Working in noisy environments',
  'Use of personal mobile device on site',
  'Packing up equipment at end of task',
]

export interface SignatoryRow {
  surveyingTask: string
  name:          string
  position:      string
  signatureDataUrl: string | null
}

export interface RiskAssessmentPDFProps {
  jobNumber:        string
  siteSpecific:     string
  managerName:      string
  specificSwmsRequired: boolean
  selectedTasks:    string[]
  additionalHazards: AdditionalHazardRow[]
  signatories:      SignatoryRow[]
  /** ISO date string for the "Revised:" footer text. */
  generatedAt: string
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#1F1F22',
    paddingTop: 28,
    paddingBottom: 28,
    paddingLeft: 28,
    paddingRight: 28,
  },
  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  brand: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1F1F22', letterSpacing: 0.5 },
  brandSub: { fontSize: 7, color: '#6B6B6F', letterSpacing: 1.2, marginTop: 1 },
  pageTitle: { flex: 1, fontSize: 18, color: '#1F1F22', textAlign: 'center' },
  // Intro line
  intro: { fontSize: 8.5, marginBottom: 8, fontStyle: 'italic' },
  introBold: { fontFamily: 'Helvetica-Bold', fontStyle: 'normal' },
  // Generic table
  tableBox: { borderWidth: 0.75, borderColor: '#000', marginBottom: 10 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000' },
  tableRowLast: { flexDirection: 'row' },
  // Job header table
  jobHeaderCell: { padding: 4, borderRightWidth: 0.5, borderRightColor: '#000' },
  jobHeaderCellLast: { padding: 4 },
  jobHeaderLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  jobHeaderValue: { fontSize: 9, marginTop: 2 },
  // "Select tasks" intro
  selectIntro: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  // Task grid (4 columns × 7 rows)
  taskGrid: { borderWidth: 0.75, borderColor: '#000', marginBottom: 10 },
  taskGridRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000' },
  taskGridRowLast: { flexDirection: 'row' },
  taskCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 4,
    borderRightWidth: 0.5,
    borderRightColor: '#000',
  },
  taskCellLast: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 4,
  },
  taskCheckbox: {
    width: 8,
    height: 8,
    borderWidth: 0.5,
    borderColor: '#000',
    marginRight: 4,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckboxChecked: {
    width: 8,
    height: 8,
    borderWidth: 0.5,
    borderColor: '#000',
    marginRight: 4,
    marginTop: 1,
    backgroundColor: '#1F1F22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckmark: { color: '#fff', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  taskText: { fontSize: 7.5, flex: 1 },
  taskTextChecked: { fontSize: 7.5, flex: 1, fontFamily: 'Helvetica-Bold' },
  // Section heading
  sectionHeading: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 4 },
  // Hazards table
  hazardHeaderRow: { flexDirection: 'row', backgroundColor: '#EFEFEF', borderBottomWidth: 0.5, borderBottomColor: '#000' },
  hazardHeaderCell: {
    padding: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 0.5,
    borderRightColor: '#000',
  },
  hazardHeaderCellLast: { padding: 3, fontSize: 7, fontFamily: 'Helvetica-Bold' },
  hazardHeaderSub: { fontSize: 6.5, fontFamily: 'Helvetica' },
  hazardSubRow: { flexDirection: 'row', backgroundColor: '#FAFAFA', borderBottomWidth: 0.5, borderBottomColor: '#000' },
  hazardSubCell: {
    padding: 2,
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#000',
  },
  hazardCell: {
    padding: 4,
    fontSize: 7.5,
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    minHeight: 50,
  },
  hazardCellLast: { padding: 4, fontSize: 7.5, minHeight: 50 },
  // Signoff text
  signoffHeading: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginTop: 6 },
  signoffBody:    { fontSize: 7.5, marginTop: 2, marginBottom: 6, lineHeight: 1.35 },
  signoffBullet:  { fontSize: 7.5, marginLeft: 8 },
  // Sign-off table
  signTableHeader: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000', backgroundColor: '#EFEFEF' },
  signHeaderCell: {
    padding: 4,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 0.5,
    borderRightColor: '#000',
  },
  signHeaderCellLast: { padding: 4, fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  signRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000', minHeight: 28 },
  signRowLast: { flexDirection: 'row', minHeight: 28 },
  signCell: {
    padding: 4,
    fontSize: 8,
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    justifyContent: 'center',
  },
  signCellLast: { padding: 4, fontSize: 8, justifyContent: 'center' },
  signatureImg: { height: 24, objectFit: 'contain' },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#6B6B6F',
  },
  // Page 2 — matrix
  matrixHeading: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  matrixHeaderBar: { backgroundColor: '#7BC97F', padding: 4, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 0 },
  matrixHead: { flexDirection: 'row' },
  matrixCornerCell: { width: 110, padding: 4, fontSize: 8, fontFamily: 'Helvetica-Bold', borderWidth: 0.5, borderColor: '#000', justifyContent: 'center' },
  matrixHeadCell: { flex: 1, padding: 4, fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center', borderWidth: 0.5, borderColor: '#000', borderLeftWidth: 0 },
  matrixHeadSub:  { fontSize: 6.5, fontFamily: 'Helvetica', marginTop: 1 },
  matrixRow: { flexDirection: 'row' },
  matrixLabelCell: { width: 110, padding: 4, fontSize: 7.5, fontFamily: 'Helvetica-Bold', borderWidth: 0.5, borderColor: '#000', borderTopWidth: 0, justifyContent: 'center' },
  matrixLabelSub:  { fontSize: 6.5, fontFamily: 'Helvetica' },
  matrixCell: { flex: 1, padding: 6, fontSize: 8.5, fontFamily: 'Helvetica-Bold', textAlign: 'center', borderWidth: 0.5, borderColor: '#000', borderTopWidth: 0, borderLeftWidth: 0 },
  matrixGreen:  { backgroundColor: '#7BC97F', color: '#1F1F22' },
  matrixAmber:  { backgroundColor: '#F2B341', color: '#1F1F22' },
  matrixRed:    { backgroundColor: '#D44848', color: '#FFFFFF' },
  // Hierarchy of Controls
  hocHeading: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 4 },
  hocBox: { borderWidth: 0.5, borderColor: '#000' },
  hocSubHeader: { padding: 4, fontSize: 7.5, fontStyle: 'italic', borderBottomWidth: 0.5, borderBottomColor: '#000' },
  hocRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#000' },
  hocRowLast: { flexDirection: 'row' },
  hocLabel: { width: 90, padding: 4, fontSize: 8, fontFamily: 'Helvetica-Bold', borderRightWidth: 0.5, borderRightColor: '#000' },
  hocText:  { flex: 1, padding: 4, fontSize: 8 },
})

// Matrix configuration
const MATRIX_ROWS: { likelihood: string; description: string; cells: { label: string; tone: 'green' | 'amber' | 'red' }[] }[] = [
  { likelihood: 'ALMOST CERTAIN', description: 'Could happen any time.',           cells: [ { label: '2/M', tone: 'amber' }, { label: '1/H', tone: 'red' },   { label: '1/H', tone: 'red' },   { label: '1/H', tone: 'red' } ] },
  { likelihood: 'LIKELY',         description: 'Could happen sometimes.',          cells: [ { label: '2/M', tone: 'amber' }, { label: '2/M', tone: 'amber' }, { label: '1/H', tone: 'red' },   { label: '1/H', tone: 'red' } ] },
  { likelihood: 'UNLIKELY',       description: 'Could happen but rare.',           cells: [ { label: '3/L', tone: 'green' }, { label: '2/M', tone: 'amber' }, { label: '2/M', tone: 'amber' }, { label: '1/H', tone: 'red' } ] },
  { likelihood: 'VERY UNLIKELY',  description: 'Could happen, but probably never will.', cells: [ { label: '3/L', tone: 'green' }, { label: '3/L', tone: 'green' }, { label: '2/M', tone: 'amber' }, { label: '3/M', tone: 'amber' } ] },
]

const HIERARCHY = [
  { label: 'Eliminate',      text: 'Elimination of risks to Health & Safety, or if not practicable to do so, then;' },
  { label: 'Substitute',     text: 'Substitute wholly or partly the hazard with something that gives rise to a lesser risk:' },
  { label: 'Isolate',        text: 'Isolate the hazard from any person exposed to it. If the hazard(s) still remain, then:' },
  { label: 'Engineering',    text: 'Engineering controls are to be implemented. If the hazard(s) still remain then:' },
  { label: 'Administrative', text: 'Administrative controls are to be implemented. IF the hazard(s) still remain, then:' },
  { label: 'PPE',            text: 'PPE (personal protective equipment) shall be used to protect the person from exposure to the hazard. PPE must be suitable and used as it is intended by the wearer.' },
]

function toneStyle(tone: 'green' | 'amber' | 'red') {
  return tone === 'green' ? styles.matrixGreen : tone === 'amber' ? styles.matrixAmber : styles.matrixRed
}

// Render the C / P / R triple inside the hazard table. Empty cells when no rating set.
function RatingTriple({ rating }: { rating: RiskRating | null }) {
  let cText = ''
  let pText = ''
  let rText = ''
  let rBg: string | undefined
  let rFg: string | undefined
  if (rating) {
    const bucket: RiskBucket = rateRisk(rating.c, rating.p)
    cText = String(rating.c)
    pText = String(rating.p)
    rText = bucket
    const colors = BUCKET_COLORS[bucket]
    rBg = colors.bg
    rFg = colors.fg
  }
  const subCellBase = {
    flex: 1,
    padding: 4,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold' as const,
    textAlign: 'center' as const,
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    minHeight: 50,
  }
  return (
    <View style={[{ flex: 1, flexDirection: 'row', borderRightWidth: 0.5, borderRightColor: '#000' }]}>
      <Text style={[subCellBase, { borderRightWidth: 0.5 }]}>{cText}</Text>
      <Text style={[subCellBase, { borderRightWidth: 0.5 }]}>{pText}</Text>
      <Text
        style={[
          subCellBase,
          { borderRightWidth: 0 },
          rBg ? { backgroundColor: rBg } : {},
          rFg ? { color: rFg } : {},
        ]}
      >
        {rText}
      </Text>
    </View>
  )
}

function chunkRows<T>(arr: T[], cols: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < arr.length; i += cols) rows.push(arr.slice(i, i + cols))
  return rows
}

function formatRevisedDate(iso: string): string {
  const d = new Date(iso)
  const month = d.toLocaleString('en-AU', { month: 'short' })
  return `Revised: ${month} ${d.getFullYear()}`
}

export function RiskAssessmentPDFDocument(props: RiskAssessmentPDFProps) {
  const {
    jobNumber, siteSpecific, managerName, specificSwmsRequired,
    selectedTasks, additionalHazards, signatories, generatedAt,
  } = props

  const taskRows = chunkRows(SWMS_TASKS, 4) // 4 columns

  return (
    <Document>
      {/* ── Page 1 ─────────────────────────────────────────────────────── */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>DELFS</Text>
            <Text style={styles.brand}>LASCELLES</Text>
            <Text style={styles.brandSub}>CONSULTING SURVEYORS</Text>
          </View>
          <Text style={styles.pageTitle}>Risk Assessment</Text>
          <View style={{ width: 80 }} />
        </View>

        <Text style={styles.intro}>
          <Text style={styles.introBold}>At each site all personnel led by the Surveyor are </Text>
          required <Text style={styles.introBold}>to assess site specific risks, hazards, procedures which are beyond the items covered in the current SWMS.</Text>
        </Text>

        {/* Job header info */}
        <View style={styles.tableBox}>
          <View style={styles.tableRowLast}>
            <View style={[styles.jobHeaderCell, { flex: 1 }]}>
              <Text style={styles.jobHeaderLabel}>DELACS JOB#:</Text>
              <Text style={styles.jobHeaderValue}>{jobNumber}</Text>
            </View>
            <View style={[styles.jobHeaderCell, { flex: 1.5 }]}>
              <Text style={styles.jobHeaderLabel}>SITE SPECIFIC:</Text>
              <Text style={styles.jobHeaderValue}>{siteSpecific || '—'}</Text>
            </View>
            <View style={[styles.jobHeaderCell, { flex: 1.5 }]}>
              <Text style={styles.jobHeaderLabel}>DELACS MANAGER RESPONSIBLE FOR THIS JOB:</Text>
              <Text style={styles.jobHeaderValue}>{managerName || '—'}</Text>
            </View>
            <View style={[styles.jobHeaderCellLast, { flex: 1.4 }]}>
              <Text style={styles.jobHeaderLabel}>
                SPECIFIC SWMS REQUIRED: {specificSwmsRequired ? 'YES' : 'NO'}
              </Text>
              <Text style={[styles.jobHeaderValue, { fontSize: 7, fontStyle: 'italic' }]}>
                If yes, contact the Project Manager to organise
              </Text>
            </View>
          </View>
        </View>

        {/* Tasks intro */}
        <Text style={styles.selectIntro}>
          Select the site-specific tasks and conditions relating to the job. Risk rating and control measures for the tasks relating to this job are listed in the generic SWMS.
        </Text>

        {/* Task grid */}
        <View style={styles.taskGrid}>
          {taskRows.map((row, ri) => {
            const isLastRow = ri === taskRows.length - 1
            return (
              <View key={ri} style={isLastRow ? styles.taskGridRowLast : styles.taskGridRow}>
                {Array.from({ length: 4 }).map((_, ci) => {
                  const task = row[ci]
                  const isLastCol = ci === 3
                  if (!task) {
                    return (
                      <View key={ci} style={isLastCol ? styles.taskCellLast : styles.taskCell}>
                        <Text style={styles.taskText}> </Text>
                      </View>
                    )
                  }
                  const checked = selectedTasks.includes(task)
                  return (
                    <View key={ci} style={isLastCol ? styles.taskCellLast : styles.taskCell}>
                      <View style={checked ? styles.taskCheckboxChecked : styles.taskCheckbox}>
                        {checked && <Text style={styles.taskCheckmark}>✓</Text>}
                      </View>
                      <Text style={checked ? styles.taskTextChecked : styles.taskText}>{task}</Text>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>

        {/* Additional hazards section */}
        <Text style={styles.sectionHeading}>Additional hazards &amp; risks requiring attention control measures:</Text>

        <View style={styles.tableBox}>
          {/* Header row */}
          <View style={styles.hazardHeaderRow}>
            <Text style={[styles.hazardHeaderCell, { flex: 1.4 }]}>
              Procedure{'\n'}
              <Text style={styles.hazardHeaderSub}>Break the job down into steps</Text>
            </Text>
            <Text style={[styles.hazardHeaderCell, { flex: 1.6 }]}>
              Potential Safety and Environmental Hazards{'\n'}
              <Text style={styles.hazardHeaderSub}>What can go wrong</Text>
            </Text>
            <Text style={[styles.hazardHeaderCell, { flex: 1, textAlign: 'center' }]}>Risk Rating</Text>
            <Text style={[styles.hazardHeaderCell, { flex: 2.5 }]}>Control Measures</Text>
            <Text style={[styles.hazardHeaderCell, { flex: 1, textAlign: 'center' }]}>Residual Risk Rating</Text>
            <Text style={[styles.hazardHeaderCellLast, { flex: 1.4 }]}>
              Person Responsible{'\n'}
              <Text style={styles.hazardHeaderSub}>To ensure management method applied</Text>
            </Text>
          </View>

          {/* Sub-header for C/P/R */}
          <View style={styles.hazardSubRow}>
            <Text style={[styles.hazardSubCell, { flex: 1.4 }]}> </Text>
            <Text style={[styles.hazardSubCell, { flex: 1.6 }]}> </Text>
            <View style={[{ flex: 1, flexDirection: 'row', borderRightWidth: 0.5, borderRightColor: '#000' }]}>
              <Text style={[styles.hazardSubCell, { flex: 1, borderRightWidth: 0.5 }]}>C</Text>
              <Text style={[styles.hazardSubCell, { flex: 1, borderRightWidth: 0.5 }]}>P =</Text>
              <Text style={[styles.hazardSubCell, { flex: 1, borderRightWidth: 0 }]}>R</Text>
            </View>
            <Text style={[styles.hazardSubCell, { flex: 2.5 }]}> </Text>
            <View style={[{ flex: 1, flexDirection: 'row', borderRightWidth: 0.5, borderRightColor: '#000' }]}>
              <Text style={[styles.hazardSubCell, { flex: 1, borderRightWidth: 0.5 }]}>C</Text>
              <Text style={[styles.hazardSubCell, { flex: 1, borderRightWidth: 0.5 }]}>P =</Text>
              <Text style={[styles.hazardSubCell, { flex: 1, borderRightWidth: 0 }]}>R</Text>
            </View>
            <Text style={[styles.hazardSubCell, { flex: 1.4, textAlign: 'left' }]}> </Text>
          </View>

          {/* Body rows — one per hazard recorded in the app. Always render at least one
              row so the table outline looks correct on the printed PDF. */}
          {(additionalHazards.length > 0 ? additionalHazards : [null]).map((row, i, arr) => {
            const isLast = i === arr.length - 1
            const containerStyle = isLast ? styles.tableRowLast : styles.tableRow
            return (
              <View key={i} style={containerStyle}>
                <Text style={[styles.hazardCell, { flex: 1.4 }]}>{row?.procedure ?? ''}</Text>
                <Text style={[styles.hazardCell, { flex: 1.6 }]}>{row?.hazard ?? ''}</Text>
                <RatingTriple rating={row?.risk ?? null} />
                <Text style={[styles.hazardCell, { flex: 2.5 }]}>{row?.control_measures ?? ''}</Text>
                <RatingTriple rating={row?.residual ?? null} />
                <Text style={[styles.hazardCellLast, { flex: 1.4 }]}>{row?.person_responsible ?? ''}</Text>
              </View>
            )
          })}
        </View>

        {/* Signoff text */}
        <Text style={styles.signoffHeading}>SIGNOFF: We the undersigned, confirm;</Text>
        <Text style={styles.signoffBullet}>- that the SWMS nominated has been explained and its contents are clearly understood and accepted on the date shown.</Text>
        <Text style={styles.signoffBullet}>- that our required qualifications to undertake this activity are current.</Text>
        <Text style={styles.signoffBullet}>- That we clearly understand the controls in this SWMS must be applied as documented; otherwise, work is to cease immediately.</Text>
        <Text style={styles.signoffBullet}>- That the nominated manager is responsible for OHS responsibilities on this job/site and I should contact them immediately of any issues that arise.</Text>

        {/* Sign-off table */}
        <View style={[styles.tableBox, { marginTop: 6 }]}>
          <View style={styles.signTableHeader}>
            <Text style={[styles.signHeaderCell,    { flex: 1.6 }]}>Surveying task</Text>
            <Text style={[styles.signHeaderCell,    { flex: 1.6 }]}>Name</Text>
            <Text style={[styles.signHeaderCell,    { flex: 1.4 }]}>Position</Text>
            <Text style={[styles.signHeaderCellLast,{ flex: 2 }]}>Signature</Text>
          </View>
          {(signatories.length > 0 ? signatories : [{ surveyingTask: '', name: '', position: '', signatureDataUrl: null }]).map((s, i, arr) => {
            const isLast = i === arr.length - 1
            return (
              <View key={i} style={isLast ? styles.signRowLast : styles.signRow}>
                <Text style={[styles.signCell,    { flex: 1.6 }]}>{s.surveyingTask}</Text>
                <Text style={[styles.signCell,    { flex: 1.6 }]}>{s.name}</Text>
                <Text style={[styles.signCell,    { flex: 1.4 }]}>{s.position}</Text>
                <View style={[styles.signCellLast,{ flex: 2 }]}>
                  {s.signatureDataUrl
                    ? <Image src={s.signatureDataUrl} style={styles.signatureImg} />
                    : <Text> </Text>}
                </View>
              </View>
            )
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{formatRevisedDate(generatedAt)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── Page 2 — Risk Matrix + Hierarchy of Controls ──────────────── */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>DELFS</Text>
            <Text style={styles.brand}>LASCELLES</Text>
            <Text style={styles.brandSub}>CONSULTING SURVEYORS</Text>
          </View>
          <Text style={styles.pageTitle}>Risk Assessment</Text>
          <View style={{ width: 80 }} />
        </View>

        {/* Matrix */}
        <View>
          <View style={styles.matrixHead}>
            <View style={styles.matrixCornerCell}>
              <Text>Risk Assessment Matrix</Text>
            </View>
            <View style={[styles.matrixHeadCell, { flex: 4, padding: 4 }]}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>Consequence (impact) table</Text>
            </View>
          </View>
          <View style={styles.matrixHead}>
            <View style={[styles.matrixCornerCell, { borderTopWidth: 0 }]}>
              <Text>Probability (Likelihood)</Text>
            </View>
            <View style={[styles.matrixHeadCell, { borderTopWidth: 0 }]}>
              <Text>MINOR</Text>
              <Text style={styles.matrixHeadSub}>First Aid needed</Text>
            </View>
            <View style={[styles.matrixHeadCell, { borderTopWidth: 0 }]}>
              <Text>MODERATE</Text>
              <Text style={styles.matrixHeadSub}>Medical attention and days off work</Text>
            </View>
            <View style={[styles.matrixHeadCell, { borderTopWidth: 0 }]}>
              <Text>MAJOR</Text>
              <Text style={styles.matrixHeadSub}>Long term illness or serious injury</Text>
            </View>
            <View style={[styles.matrixHeadCell, { borderTopWidth: 0 }]}>
              <Text>EXTREME</Text>
              <Text style={styles.matrixHeadSub}>Kill or cause permanent disability or ill health</Text>
            </View>
          </View>

          {MATRIX_ROWS.map((row, ri) => (
            <View key={ri} style={styles.matrixRow}>
              <View style={styles.matrixLabelCell}>
                <Text>{row.likelihood}</Text>
                <Text style={styles.matrixLabelSub}>{row.description}</Text>
              </View>
              {row.cells.map((c, ci) => (
                <Text key={ci} style={[styles.matrixCell, toneStyle(c.tone)]}>{c.label}</Text>
              ))}
            </View>
          ))}
        </View>

        {/* Hierarchy of Controls */}
        <Text style={styles.hocHeading}>Hierarchy of Controls</Text>
        <View style={styles.hocBox}>
          <Text style={styles.hocSubHeader}>
            Hierarchy of Controls – must be implemented so far as is reasonably practicable (as per DL-Pro-06 HSE Risk Management Procedure)
          </Text>
          {HIERARCHY.map((row, i, arr) => {
            const isLast = i === arr.length - 1
            return (
              <View key={row.label} style={isLast ? styles.hocRowLast : styles.hocRow}>
                <Text style={styles.hocLabel}>{row.label}</Text>
                <Text style={styles.hocText}>{row.text}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.footer} fixed>
          <Text>{formatRevisedDate(generatedAt)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
