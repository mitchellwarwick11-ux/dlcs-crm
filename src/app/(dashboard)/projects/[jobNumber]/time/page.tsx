import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogTimeForm } from '@/components/time/log-time-form'
import { TimeEntryRow } from '@/components/time/time-entry-row'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatHours } from '@/lib/utils/formatters'

export default async function TimePage({
  params,
}: {
  params: Promise<{ jobNumber: string }>
}) {
  const { jobNumber } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const { data: project } = await supabase
    .from('projects')
    .select('id, is_billable')
    .eq('job_number', jobNumber)
    .returns<any[]>()
    .single()

  if (!project) notFound()
  const p = project as any

  const [
    { data: entries },
    { data: tasks },
    { data: staff },
    { data: projectRates },
  ] = await Promise.all([
    db
      .from('time_entries')
      .select(`
        id, date, hours, description, is_billable, rate_at_time, invoice_item_id,
        task_id, staff_id, project_id,
        staff_profiles ( full_name, role ),
        project_tasks ( title ),
        invoice_items!invoice_item_id ( invoices ( invoice_number ) )
      `)
      .eq('project_id', p.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    db
      .from('project_tasks')
      .select('id, project_id, title, fee_type, status')
      .eq('project_id', p.id)
      .not('status', 'eq', 'cancelled')
      .order('sort_order'),
    db
      .from('staff_profiles')
      .select('id, full_name, role, default_hourly_rate')
      .eq('is_active', true)
      .order('full_name'),
    db
      .from('project_staff_rates')
      .select('staff_id, hourly_rate')
      .eq('project_id', p.id),
  ])

  const entryList = (entries      ?? []) as any[]
  const taskList  = (tasks        ?? []) as any[]
  const staffList = (staff        ?? []) as any[]
  const rates     = (projectRates ?? []) as any[]

  // Flatten invoice_number onto each entry
  const enrichedEntries = entryList.map((e: any) => ({
    ...e,
    job_number: jobNumber,
    invoice_number: e.invoice_items?.invoices?.invoice_number ?? null,
  }))

  const totalHours       = entryList.reduce((s: number, e: any) => s + e.hours, 0)
  const billableHours    = entryList.filter((e: any) => e.is_billable).reduce((s: number, e: any) => s + e.hours, 0)
  const billableValue    = entryList.filter((e: any) => e.is_billable).reduce((s: number, e: any) => s + e.hours * e.rate_at_time, 0)
  const nonBillableHours = totalHours - billableHours

  return (
    <div className="p-8 space-y-6">

      {/* Log Time */}
      <Card>
        <CardHeader><CardTitle>Log Time</CardTitle></CardHeader>
        <CardContent>
          <LogTimeForm
            projectId={p.id}
            staff={staffList}
            tasks={taskList}
            projectRates={rates}
            defaultBillable={p.is_billable ?? true}
          />
        </CardContent>
      </Card>

      {/* Summary */}
      {entryList.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Hours',    value: formatHours(totalHours),       cls: 'text-slate-900' },
            { label: 'Billable Hours', value: formatHours(billableHours),    cls: 'text-slate-900' },
            { label: 'Billable Value', value: formatCurrency(billableValue), cls: 'text-slate-900' },
            { label: 'Non-Billable',   value: formatHours(nonBillableHours), cls: 'text-slate-500' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-white rounded-lg border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-lg font-semibold ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Entries table */}
      {entryList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <p className="text-sm text-slate-500">No time logged yet.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Time Entries
              <span className="ml-2 text-sm font-normal text-slate-500">
                {entryList.length} entr{entryList.length === 1 ? 'y' : 'ies'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Date','Staff','Task','Task Description','Hours','Rate','Amount','','Invoice',''].map((h, i) => (
                      <th key={i} className={`px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap ${
                        i >= 4 ? 'text-right' : 'text-left'
                      } ${i === 7 ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrichedEntries.map((entry: any) => (
                    <TimeEntryRow
                      key={entry.id}
                      entry={entry}
                      staff={staffList}
                      tasks={taskList}
                      variant="job"
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={4} className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">{formatHours(totalHours)}</td>
                    <td />
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(billableValue)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
