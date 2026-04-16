'use client'

import { CsvImporter, FieldDef, ImportRowResult } from '@/components/import/csv-importer'
import { createClient } from '@/lib/supabase/client'

const FIELDS: FieldDef[] = [
  { key: 'job_number',   label: 'Job Number',   required: true,  description: 'e.g. 26014',                         example: '26014' },
  { key: 'title',        label: 'Title',        required: false, description: 'Defaults to job number if blank',     example: '26014 - Newstead' },
  { key: 'job_type',     label: 'Job Type',     required: false, description: 'survey, sewer_water, or internal',    example: 'survey' },
  { key: 'status',       label: 'Status',       required: false, description: 'active, on_hold, completed, cancelled — defaults to active', example: 'active' },
  { key: 'client_name',  label: 'Client',       required: false, description: 'Matched by name or company name',    example: 'ACME Corp' },
  { key: 'site_address', label: 'Site Address', required: false,                                                     example: '9 Henley St' },
  { key: 'suburb',       label: 'Suburb',       required: false,                                                     example: 'New Lambton' },
  { key: 'lot_number',   label: 'Lot Number',   required: false,                                                     example: '35' },
  { key: 'plan_number',  label: 'Plan Number',  required: false,                                                     example: 'DP20217' },
  { key: 'job_manager',  label: 'Job Manager',  required: false, description: 'Matched by staff full name',         example: 'Alex Lascelles' },
  { key: 'is_billable',  label: 'Billable',     required: false, description: 'true or false — defaults to true',   example: 'true' },
  { key: 'description',  label: 'Notes',        required: false,                                                     example: 'Internal notes' },
]

const VALID_JOB_TYPES = ['survey', 'sewer_water', 'internal']
const VALID_STATUSES   = ['active', 'on_hold', 'completed', 'cancelled', 'archived']

function parseJobNumber(raw: string): { year: number; sequence: number } {
  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 4) {
    const year     = parseInt('20' + digits.substring(0, 2))
    const sequence = parseInt(digits.substring(2)) || 0
    return { year, sequence }
  }
  return { year: new Date().getFullYear(), sequence: 0 }
}

async function importJobRow(row: Record<string, string>): Promise<ImportRowResult> {
  const jobNumber = row.job_number?.trim()
  if (!jobNumber) return { success: false, message: 'Skipped — Job Number is blank' }

  const db = createClient() as any

  // Resolve client
  let clientId: string | null = null
  const clientName = row.client_name?.trim()
  if (clientName) {
    const { data: clients } = await db
      .from('clients')
      .select('id, name, company_name')
      .or(`name.ilike.${clientName},company_name.ilike.${clientName}`)
      .limit(1)
    clientId = clients?.[0]?.id ?? null
    if (!clientId) return { success: false, message: `Client not found: "${clientName}" — import clients first` }
  }

  // Resolve job manager
  let jobManagerId: string | null = null
  const managerName = row.job_manager?.trim()
  if (managerName) {
    const { data: staff } = await db
      .from('staff_profiles')
      .select('id')
      .ilike('full_name', managerName)
      .limit(1)
    jobManagerId = staff?.[0]?.id ?? null
  }

  const { year, sequence } = parseJobNumber(jobNumber)
  const jobType = VALID_JOB_TYPES.includes(row.job_type?.trim()) ? row.job_type.trim() : 'survey'
  const status  = VALID_STATUSES.includes(row.status?.trim())   ? row.status.trim()   : 'active'

  const { error } = await db.from('projects').insert({
    job_number:     jobNumber,
    year,
    sequence,
    job_type:       jobType,
    status,
    client_id:      clientId,
    job_manager_id: jobManagerId,
    title:          row.title?.trim() || jobNumber,
    site_address:   row.site_address?.trim() || null,
    suburb:         row.suburb?.trim()       || null,
    lot_number:     row.lot_number?.trim()   || null,
    plan_number:    row.plan_number?.trim()  || null,
    description:    row.description?.trim()  || null,
    is_billable:    row.is_billable?.trim().toLowerCase() !== 'false',
  })

  if (error) return { success: false, message: `Failed: ${error.message}` }
  return { success: true, message: `Imported: ${jobNumber}${row.title ? ` — ${row.title.trim()}` : ''}` }
}

export default function ImportJobsPage() {
  return (
    <div className="p-8">
      <CsvImporter
        title="Import Jobs"
        description="Upload a CSV of jobs/projects. Client names are matched to existing clients — import clients first. Job manager is matched by staff full name."
        fields={FIELDS}
        onImportRow={importJobRow}
      />
    </div>
  )
}
