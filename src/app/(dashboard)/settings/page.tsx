import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RoleRatesManager } from '@/components/settings/role-rates-manager'
import { ClearDemoButton } from '@/components/settings/clear-demo-button'
import { CompanySettingsForm } from '@/components/settings/company-settings-form'
import { ClearAllDataButton } from '@/components/settings/clear-all-data-button'
import { ExportBackupButton, RestoreBackupButton } from '@/components/settings/backup-restore'
import { AccessRightsManager } from '@/components/settings/access-rights-manager'
import { ScheduleEquipmentManager } from '@/components/settings/schedule-equipment-manager'
import { NumberSequencesManager } from '@/components/settings/number-sequences-manager'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const currentYear = new Date().getFullYear()

  const [
    { data: roleRates },
    { data: companyRows },
    { data: staffRows },
    { data: equipment },
    { data: jobSeqRow },
    { data: quoteSeqRow },
  ] = await Promise.all([
    db.from('role_rates').select('*').order('sort_order'),
    db.from('company_settings').select('key, value'),
    db.from('staff_profiles').select('id, full_name, role, is_active, access_level').order('full_name'),
    db.from('schedule_equipment').select('*').order('sort_order'),
    db.from('job_number_sequences').select('last_sequence').eq('year', currentYear).maybeSingle(),
    db.from('quote_number_sequences').select('last_sequence').eq('id', 1).maybeSingle(),
  ])

  const companySettings: Record<string, string> = {}
  for (const row of (companyRows ?? [])) {
    companySettings[row.key] = row.value
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage system-wide configuration.</p>
      </div>

      <div className="mb-10">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Company Details</h2>
        <p className="text-sm text-slate-500 mb-4">Used on invoices and other documents.</p>
        <CompanySettingsForm initial={companySettings} />
      </div>

      <div className="border-t border-slate-200 pt-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Numbering</h2>
        <p className="text-sm text-slate-500 mb-4">
          Set the next number to use when creating a job or quote. Useful after importing existing records.
        </p>
        <NumberSequencesManager
          currentYear={currentYear}
          jobLastSequence={jobSeqRow?.last_sequence ?? null}
          quoteLastSequence={quoteSeqRow?.last_sequence ?? 5000}
        />
      </div>

      <div className="border-t border-slate-200 pt-8 mt-10">
        <RoleRatesManager initialRoleRates={roleRates ?? []} />
      </div>

      <div className="mt-10 pt-8 border-t border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Access Rights</h2>
        <p className="text-sm text-slate-500 mb-4">
          Control what each staff member can access. Changes take effect next time they log in.
        </p>
        <AccessRightsManager staffList={staffRows ?? []} />
      </div>

      <div className="mt-10 pt-8 border-t border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Field Schedule Equipment</h2>
        <p className="text-sm text-slate-500 mb-4">
          Equipment and resources available when scheduling fieldwork bookings.
        </p>
        <ScheduleEquipmentManager initialEquipment={equipment ?? []} />
      </div>

      <div className="mt-10 pt-8 border-t border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Checklist Templates</h2>
        <p className="text-sm text-slate-500 mb-4">
          Create one checklist per task type (e.g. Set-out Survey, Identification Survey).
          The checklist will be shown to the field surveyor in the Job Brief &amp; Checklists
          section of the Field App.
        </p>
        <Link
          href="/settings/checklist-templates"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded hover:bg-slate-700 transition-colors"
        >
          Manage Checklist Templates
        </Link>
      </div>

      <div className="mt-10 pt-8 border-t border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Import Data</h2>
        <p className="text-sm text-slate-500 mb-4">
          Import clients, jobs, and timesheets from a CSV export of another system.
        </p>
        <Link
          href="/settings/import"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded hover:bg-slate-700 transition-colors"
        >
          Go to Import
        </Link>
      </div>

      <div className="mt-10 pt-8 border-t border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Backup &amp; Restore</h2>
        <p className="text-sm text-slate-500 mb-4">
          Export all your data as a JSON backup file, or restore from a previous backup.
          Staff profiles, role rates, and company settings are not affected.
        </p>
        <div className="flex gap-3">
          <ExportBackupButton />
          <RestoreBackupButton />
        </div>
      </div>

      <div className="mt-10 pt-8 border-t border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Danger Zone</h2>
        <p className="text-sm text-slate-500 mb-4">
          Permanently delete all clients, jobs, tasks, quotes, invoices, and time entries.
          Use this to wipe test data before importing your real data.
          Staff profiles, role rates, and company settings are not affected.
        </p>
        <ClearAllDataButton />
      </div>

      <div className="mt-10 pt-8 border-t border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Demo Data</h2>
        <p className="text-sm text-slate-500 mb-4">
          Remove all demo/seed records added for testing purposes.
          Your real clients, jobs, and quotes will not be affected.
        </p>
        <ClearDemoButton />
      </div>
    </div>
  )
}
