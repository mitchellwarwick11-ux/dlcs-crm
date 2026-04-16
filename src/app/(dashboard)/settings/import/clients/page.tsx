'use client'

import { CsvImporter, FieldDef, ImportRowResult } from '@/components/import/csv-importer'
import { createClient } from '@/lib/supabase/client'

const FIELDS: FieldDef[] = [
  { key: 'name',          label: 'Name',           required: false, description: 'Individual full name — required if no Company Name', example: 'John Smith' },
  { key: 'company_name',  label: 'Company Name',   required: false, description: 'Required if no individual Name',                    example: 'ACME Corp' },
  { key: 'email',         label: 'Email',          required: false,                                                example: 'john@acme.com' },
  { key: 'phone',         label: 'Phone',          required: false,                                                example: '0412 345 678' },
  { key: 'address_line1', label: 'Address',        required: false,                                                example: '12 Main St' },
  { key: 'suburb',        label: 'Suburb',         required: false,                                                example: 'Newstead' },
  { key: 'state',         label: 'State',          required: false, description: 'e.g. QLD, NSW',                 example: 'QLD' },
  { key: 'postcode',      label: 'Postcode',       required: false,                                                example: '4006' },
  { key: 'notes',         label: 'Notes',          required: false,                                                example: 'VIP client' },
]

async function importClientRow(row: Record<string, string>): Promise<ImportRowResult> {
  const name        = row.name?.trim()
  const companyName = row.company_name?.trim()

  if (!name && !companyName) {
    return { success: false, message: 'Skipped — Name or Company Name is required' }
  }

  // If only a company is provided, use it as the name field too
  const resolvedName = name || companyName!

  const db = createClient() as any
  const { error } = await db.from('clients').insert({
    name:          resolvedName,
    company_name:  companyName || null,
    email:         row.email?.trim()         || null,
    phone:         row.phone?.trim()         || null,
    address_line1: row.address_line1?.trim() || null,
    suburb:        row.suburb?.trim()        || null,
    state:         row.state?.trim()         || null,
    postcode:      row.postcode?.trim()      || null,
    notes:         row.notes?.trim()         || null,
    is_active:     true,
  })

  if (error) return { success: false, message: `Failed: ${error.message}` }
  return { success: true, message: `Imported: ${companyName || name}` }
}

export default function ImportClientsPage() {
  return (
    <div className="p-8">
      <CsvImporter
        title="Import Clients"
        description="Upload a CSV of clients and map your columns to the app fields. Each row becomes one client record."
        fields={FIELDS}
        onImportRow={importClientRow}
      />
    </div>
  )
}
