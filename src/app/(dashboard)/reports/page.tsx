import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatHours } from '@/lib/utils/formatters'
import { DateFilterForm } from '@/components/reports/date-filter-form'

function getDefaultDates() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = now
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const defaults = getDefaultDates()
  const from = sp.from ?? defaults.from
  const to   = sp.to   ?? defaults.to

  const db = supabase as any

  // Fetch all uninvoiced time entries in range, with project + job manager info
  const { data: entries } = await db
    .from('time_entries')
    .select(`
      id, hours, rate_at_time, date, description,
      projects (
        id, job_number, title, suburb,
        job_manager:staff_profiles!job_manager_id ( id, full_name )
      )
    `)
    .is('invoice_item_id', null)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })

  const entryList = (entries ?? []) as any[]

  // Group by job manager → project
  const managerMap = new Map<string, {
    id: string
    name: string
    projects: Map<string, {
      id: string
      jobNumber: string
      title: string
      suburb: string | null
      hours: number
      value: number
    }>
  }>()

  for (const entry of entryList) {
    const project = entry.projects
    if (!project) continue

    const manager = project.job_manager
    const managerId   = manager?.id   ?? 'unassigned'
    const managerName = manager?.full_name ?? 'Unassigned'

    if (!managerMap.has(managerId)) {
      managerMap.set(managerId, { id: managerId, name: managerName, projects: new Map() })
    }

    const mgr = managerMap.get(managerId)!
    if (!mgr.projects.has(project.id)) {
      mgr.projects.set(project.id, {
        id: project.id,
        jobNumber: project.job_number,
        title: project.title,
        suburb: project.suburb,
        hours: 0,
        value: 0,
      })
    }

    const proj = mgr.projects.get(project.id)!
    proj.hours += entry.hours
    proj.value += entry.hours * entry.rate_at_time
  }

  // Company totals
  const totalValue = entryList.reduce((s, e) => s + e.hours * e.rate_at_time, 0)

  const managers = Array.from(managerMap.values()).sort((a, b) => {
    if (a.id === 'unassigned') return 1
    if (b.id === 'unassigned') return -1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="p-8 max-w-5xl space-y-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">WIP Report</h1>
        <p className="text-sm text-slate-500 mt-1">Uninvoiced time entries by job manager</p>
      </div>

      {/* Date filter */}
      <DateFilterForm initialFrom={from} initialTo={to} />

      {/* Company summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 inline-block">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total WIP Value</div>
        <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalValue)}</div>
        <div className="text-xs text-slate-400 mt-1">ex GST</div>
      </div>

      {/* No data state */}
      {managers.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <p className="text-sm text-slate-500">No uninvoiced time entries found for this period.</p>
        </div>
      )}

      {/* Breakdown by job manager */}
      {managers.map(mgr => {
        const mgrHours = Array.from(mgr.projects.values()).reduce((s, p) => s + p.hours, 0)
        const mgrValue = Array.from(mgr.projects.values()).reduce((s, p) => s + p.value, 0)
        const projects = Array.from(mgr.projects.values()).sort((a, b) => b.value - a.value)

        return (
          <div key={mgr.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">

            {/* Manager header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <div className="font-semibold text-slate-900">{mgr.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {projects.length} job{projects.length !== 1 ? 's' : ''} &middot; {formatHours(mgrHours)} uninvoiced
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900">{formatCurrency(mgrValue)}</div>
                <div className="text-xs text-slate-400">ex GST</div>
              </div>
            </div>

            {/* Jobs table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Job</th>
                  <th className="text-left px-6 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Location</th>
                  <th className="text-right px-6 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Hours</th>
                  <th className="text-right px-6 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">WIP Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {projects.map(proj => (
                  <tr key={proj.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <Link
                        href={`/projects/${proj.jobNumber}/time`}
                        className="font-mono font-medium text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {proj.jobNumber}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">{proj.title}</div>
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {proj.suburb ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-700 tabular-nums">
                      {formatHours(proj.hours)}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(proj.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        )
      })}

    </div>
  )
}
