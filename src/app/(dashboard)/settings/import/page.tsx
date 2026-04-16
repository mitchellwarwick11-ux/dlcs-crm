import Link from 'next/link'
import { Users, FolderOpen, Clock, ArrowRight } from 'lucide-react'

const options = [
  {
    href: '/settings/import/clients',
    icon: Users,
    title: 'Import Clients',
    description: 'Import client names, companies, contact details and addresses.',
    fields: ['Name', 'Company', 'Email', 'Phone', 'Address', 'Suburb', 'State'],
  },
  {
    href: '/settings/import/jobs',
    icon: FolderOpen,
    title: 'Import Jobs',
    description: 'Import jobs/projects with client linkage, site details and job manager.',
    fields: ['Job Number', 'Title', 'Client', 'Type', 'Status', 'Site Address', 'Job Manager'],
  },
  {
    href: '/settings/import/timesheets',
    icon: Clock,
    title: 'Import Timesheets',
    description: 'Import time entries against existing jobs and staff members.',
    fields: ['Job Number', 'Staff', 'Date', 'Hours', 'Task', 'Description', 'Rate'],
  },
]

export default function ImportHubPage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-slate-900">Import Data</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload a CSV from any CRM or spreadsheet and map your columns to the app fields.
          Import clients first, then jobs, then timesheets.
        </p>
      </div>

      <div className="space-y-4">
        {options.map(({ href, icon: Icon, title, description, fields }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-5 bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
              <Icon className="h-5 w-5 text-slate-500 group-hover:text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900">{title}</div>
              <div className="text-sm text-slate-500 mt-0.5">{description}</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {fields.map(f => (
                  <span key={f} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 shrink-0 transition-colors" />
          </Link>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-6">
        Tip: Export your existing CRM data to CSV, then use each importer to map your column names to the correct fields.
        Duplicate checking is not currently performed — avoid importing the same file twice.
      </p>
    </div>
  )
}
