'use client'

import { CsvImporter, FieldDef, ImportRowResult } from '@/components/import/csv-importer'
import { createClient } from '@/lib/supabase/client'

const FIELDS: FieldDef[] = [
  { key: 'job_number',  label: 'Job Number',  required: true,  description: 'Must match an existing job',              example: '26014' },
  { key: 'staff_name',  label: 'Staff Member', required: true,  description: 'Must match staff full name in the app',  example: 'Alex Lascelles' },
  { key: 'date',        label: 'Date',         required: true,  description: 'DD/MM/YYYY, YYYY-MM-DD, or DD-Mon-YY',   example: '25-Feb-26' },
  { key: 'hours',       label: 'Hours',        required: true,  description: 'Decimal hours e.g. 2.5',                 example: '2.5' },
  { key: 'task_title',  label: 'Task',         required: false, description: 'Matched by task title on the job',       example: 'Contour Survey' },
  { key: 'description', label: 'Description',  required: false, description: 'Notes about the work done',              example: 'Field survey work' },
  { key: 'is_billable', label: 'Billable',     required: false, description: 'true or false — defaults to job setting', example: 'true' },
  { key: 'rate',        label: 'Hourly Rate',  required: false, description: 'If blank, uses staff default rate',      example: '145' },
]

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function parseDate(raw: string): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()

  // DD/MM/YYYY
  const dmySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmySlash) {
    const [, d, m, y] = dmySlash
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD-Mon-YY  e.g. 25-Feb-26  (2-digit year → 2000s)
  const dmyMon = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
  if (dmyMon) {
    const [, d, mon, yy] = dmyMon
    const mm = MONTH_MAP[mon.toLowerCase()]
    if (mm) return `20${yy}-${mm}-${d.padStart(2, '0')}`
  }

  // DD-Mon-YYYY  e.g. 25-Feb-2026
  const dmyMonFull = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (dmyMonFull) {
    const [, d, mon, y] = dmyMonFull
    const mm = MONTH_MAP[mon.toLowerCase()]
    if (mm) return `${y}-${mm}-${d.padStart(2, '0')}`
  }

  // Try native parse as last resort
  const dt = new Date(s)
  if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0]
  return null
}

async function importTimesheetRow(row: Record<string, string>): Promise<ImportRowResult> {
  const jobNumber = row.job_number?.trim()
  const staffName = row.staff_name?.trim()
  const rawDate   = row.date?.trim()
  const rawHours  = row.hours?.trim()

  if (!jobNumber) return { success: false, message: 'Skipped — Job Number is blank' }
  if (!staffName) return { success: false, message: 'Skipped — Staff Member is blank' }
  if (!rawDate)   return { success: false, message: 'Skipped — Date is blank' }
  if (!rawHours)  return { success: false, message: 'Skipped — Hours is blank' }

  const date  = parseDate(rawDate)
  if (!date)  return { success: false, message: `Invalid date format: "${rawDate}" — use DD/MM/YYYY` }

  const hours = parseFloat(rawHours)
  if (isNaN(hours) || hours <= 0) return { success: false, message: `Invalid hours: "${rawHours}"` }

  const db = createClient() as any

  // Find project
  const { data: projects } = await db
    .from('projects')
    .select('id, is_billable')
    .eq('job_number', jobNumber)
    .limit(1)
  const project = projects?.[0]
  if (!project) return { success: false, message: `Job not found: "${jobNumber}"` }

  // Find staff
  const { data: staffList } = await db
    .from('staff_profiles')
    .select('id, default_hourly_rate')
    .ilike('full_name', staffName)
    .limit(1)
  const staff = staffList?.[0]
  if (!staff) return { success: false, message: `Staff not found: "${staffName}"` }

  // Find task (optional)
  let taskId: string | null = null
  const taskTitle = row.task_title?.trim()
  if (taskTitle) {
    const { data: tasks } = await db
      .from('project_tasks')
      .select('id')
      .eq('project_id', project.id)
      .ilike('title', taskTitle)
      .limit(1)
    taskId = tasks?.[0]?.id ?? null
  }

  const rate = row.rate?.trim() ? parseFloat(row.rate.trim()) : (staff.default_hourly_rate ?? 0)
  const billableRaw = row.is_billable?.trim().toLowerCase()
  const isBillable = (billableRaw === 'false' || billableRaw === 'non-billable' || billableRaw === 'no')
    ? false
    : (project.is_billable ?? true)

  const { error } = await db.from('time_entries').insert({
    project_id:    project.id,
    staff_id:      staff.id,
    task_id:       taskId,
    date,
    hours,
    description:   row.description?.trim() || null,
    is_billable:   isBillable,
    rate_at_time:  rate,
  })

  if (error) return { success: false, message: `Failed: ${error.message}` }
  return { success: true, message: `Imported: ${hours}h for ${staffName} on ${jobNumber} (${date})` }
}

export default function ImportTimesheetsPage() {
  return (
    <div className="p-8">
      <CsvImporter
        title="Import Timesheets"
        description="Upload a CSV of time entries. Jobs and staff are matched by name — import jobs first. Dates accepted as DD/MM/YYYY, YYYY-MM-DD, or DD-Mon-YY (e.g. 25-Feb-26)."
        fields={FIELDS}
        onImportRow={importTimesheetRow}
      />
    </div>
  )
}
