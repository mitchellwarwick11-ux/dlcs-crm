import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogTimeForm } from '@/components/time/log-time-form'
import { TimeEntryRow } from '@/components/time/time-entry-row'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatHours } from '@/lib/utils/formatters'

type SortKey = 'date' | 'staff' | 'task' | 'description' | 'hours' | 'rate' | 'amount' | 'billable' | 'invoice'
type SortDirection = 'asc' | 'desc'

const SORT_KEYS: SortKey[] = ['date', 'staff', 'task', 'description', 'hours', 'rate', 'amount', 'billable', 'invoice']

function getSortValue(entry: any, sort: SortKey): string | number {
  switch (sort) {
    case 'date':        return entry.date ?? ''
    case 'staff':       return entry.staff_profiles?.full_name ?? ''
    case 'task':        return entry.project_tasks?.title ?? ''
    case 'description': return entry.description ?? ''
    case 'hours':       return entry.hours ?? 0
    case 'rate':        return entry.rate_at_time ?? 0
    case 'amount':      return (entry.hours ?? 0) * (entry.rate_at_time ?? 0)
    case 'billable':    return entry.is_billable ? 1 : 0
    case 'invoice':     return entry.invoice_number ?? ''
  }
}

function compareValues(a: string | number, b: string | number) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export default async function TimePage({
  params,
  searchParams,
}: {
  params: Promise<{ jobNumber: string }>
  searchParams: Promise<{
    sort?: string
    dir?: string
    staff?: string
    task?: string
    billable?: string
    invoiced?: string
    from?: string
    to?: string
    q?: string
  }>
}) {
  const { jobNumber } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sort: SortKey = (SORT_KEYS as string[]).includes(sp.sort ?? '') ? (sp.sort as SortKey) : 'date'
  const dir: SortDirection = sp.dir === 'asc' ? 'asc' : 'desc'

  const db = supabase as any

  const { data: project } = await supabase
    .from('projects')
    .select('id, is_billable')
    .eq('job_number', jobNumber)
    .returns<any[]>()
    .single()

  if (!project) notFound()
  const p = project as any

  let entriesQuery = db
    .from('time_entries')
    .select(`
      id, date, hours, description, is_billable, is_variation, rate_at_time, invoice_item_id,
      task_id, staff_id, project_id, acting_role,
      staff_profiles!staff_id ( full_name, role ),
      project_tasks ( title ),
      invoice_items!invoice_item_id ( invoices ( invoice_number ) )
    `)
    .eq('project_id', p.id)

  if (sp.staff)         entriesQuery = entriesQuery.eq('staff_id', sp.staff)
  if (sp.task)          entriesQuery = entriesQuery.eq('task_id', sp.task)
  if (sp.billable === 'yes') entriesQuery = entriesQuery.eq('is_billable', true)
  if (sp.billable === 'no')  entriesQuery = entriesQuery.eq('is_billable', false)
  if (sp.invoiced === 'yes') entriesQuery = entriesQuery.not('invoice_item_id', 'is', null)
  if (sp.invoiced === 'no')  entriesQuery = entriesQuery.is('invoice_item_id', null)
  if (sp.from)          entriesQuery = entriesQuery.gte('date', sp.from)
  if (sp.to)            entriesQuery = entriesQuery.lte('date', sp.to)
  if (sp.q)             entriesQuery = entriesQuery.ilike('description', `%${sp.q}%`)

  entriesQuery = entriesQuery
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  const [
    { data: entries },
    { data: tasks },
    { data: staff },
    { data: projectRates },
    { data: roleRates },
  ] = await Promise.all([
    entriesQuery,
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
      .from('project_role_rates')
      .select('role_key, hourly_rate')
      .eq('project_id', p.id),
    db
      .from('role_rates')
      .select('role_key, label, hourly_rate')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const entryList = (entries      ?? []) as any[]
  const taskList  = (tasks        ?? []) as any[]
  const staffList = (staff        ?? []) as any[]
  const rates     = (projectRates ?? []) as any[]
  const roleList  = (roleRates    ?? []) as any[]

  // Flatten invoice_number onto each entry
  const enrichedEntries = entryList
    .map((e: any) => ({
      ...e,
      job_number: jobNumber,
      invoice_number: e.invoice_items?.invoices?.invoice_number ?? null,
    }))
    .sort((a, b) => {
      const result = compareValues(getSortValue(a, sort), getSortValue(b, sort))
      return dir === 'asc' ? result : -result
    })

  const totalHours       = entryList.reduce((s: number, e: any) => s + e.hours, 0)
  const billableHours    = entryList.filter((e: any) => e.is_billable).reduce((s: number, e: any) => s + e.hours, 0)
  const billableValue    = entryList.filter((e: any) => e.is_billable).reduce((s: number, e: any) => s + e.hours * e.rate_at_time, 0)
  const nonBillableHours = totalHours - billableHours

  const basePath = `/projects/${jobNumber}/time`

  function buildHref(next: Partial<{ sort: SortKey; dir: SortDirection }>) {
    const search = new URLSearchParams()
    if (sp.staff)    search.set('staff', sp.staff)
    if (sp.task)     search.set('task', sp.task)
    if (sp.billable) search.set('billable', sp.billable)
    if (sp.invoiced) search.set('invoiced', sp.invoiced)
    if (sp.from)     search.set('from', sp.from)
    if (sp.to)       search.set('to', sp.to)
    if (sp.q)        search.set('q', sp.q)
    if (next.sort)   search.set('sort', next.sort)
    if (next.dir)    search.set('dir', next.dir)
    const qs = search.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  function getSortHref(column: SortKey) {
    const nextDir: SortDirection = sort === column && dir === 'asc' ? 'desc' : 'asc'
    return buildHref({ sort: column, dir: nextDir })
  }

  function indicator(column: SortKey) {
    if (sort !== column) return ''
    return dir === 'asc' ? '↑' : '↓'
  }

  const hasFilters = Boolean(sp.staff || sp.task || sp.billable || sp.invoiced || sp.from || sp.to || sp.q)

  const SORTABLE_HEADERS: { key: SortKey; label: string; align: 'left' | 'right' | 'center' }[] = [
    { key: 'date',        label: 'Date',             align: 'left'   },
    { key: 'staff',       label: 'Staff',            align: 'left'   },
    { key: 'task',        label: 'Task',             align: 'left'   },
    { key: 'description', label: 'Task Description', align: 'left'   },
    { key: 'hours',       label: 'Hours',            align: 'right'  },
    { key: 'rate',        label: 'Rate',             align: 'right'  },
    { key: 'amount',      label: 'Amount',           align: 'right'  },
    { key: 'billable',    label: '',                 align: 'center' },
    { key: 'invoice',     label: 'Invoice',          align: 'right'  },
  ]

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
            roleRates={roleList}
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

      {/* Filters */}
      {(() => {
        const base = 'h-10 rounded-lg border px-3 text-sm focus:outline-none'
        const inactive = 'border-slate-200 bg-white text-slate-800'
        const active = 'border-dlcs-brand bg-dlcs-brand/10 text-slate-900 ring-1 ring-dlcs-brand/30 font-medium'
        const cls = (on: boolean, extra = '') => `${base} ${on ? active : inactive} ${extra}`
        return (
      <form method="GET" className="flex flex-wrap gap-2.5 items-center">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Search description…"
          className={cls(!!sp.q, 'placeholder:text-slate-400 min-w-[200px]')}
        />
        <select
          name="staff"
          defaultValue={sp.staff ?? ''}
          className={cls(!!sp.staff, 'cursor-pointer')}
        >
          <option value="">All staff</option>
          {staffList.map((s: any) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
        <select
          name="task"
          defaultValue={sp.task ?? ''}
          className={cls(!!sp.task, 'cursor-pointer max-w-[220px]')}
        >
          <option value="">All tasks</option>
          {taskList.map((t: any) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <select
          name="billable"
          defaultValue={sp.billable ?? ''}
          className={cls(!!sp.billable, 'cursor-pointer')}
        >
          <option value="">Billable: All</option>
          <option value="yes">Billable</option>
          <option value="no">Non-billable</option>
        </select>
        <select
          name="invoiced"
          defaultValue={sp.invoiced ?? ''}
          className={cls(!!sp.invoiced, 'cursor-pointer')}
        >
          <option value="">Invoiced: All</option>
          <option value="yes">Invoiced</option>
          <option value="no">Not invoiced</option>
        </select>
        <input
          type="date"
          name="from"
          defaultValue={sp.from ?? ''}
          className={cls(!!sp.from)}
        />
        <input
          type="date"
          name="to"
          defaultValue={sp.to ?? ''}
          className={cls(!!sp.to)}
        />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <Button type="submit" variant="outline" size="sm" className="h-10 rounded-lg">Filter</Button>
        {hasFilters && (
          <Link href={`${basePath}?sort=${sort}&dir=${dir}`}>
            <Button variant="ghost" size="sm" className="h-10">Clear</Button>
          </Link>
        )}
      </form>
        )
      })()}

      {/* Entries table */}
      {enrichedEntries.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <p className="text-sm text-slate-500">
            {entryList.length === 0 && !hasFilters ? 'No time logged yet.' : 'No entries match the current filters.'}
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Time Entries
              <span className="ml-2 text-sm font-normal text-slate-500">
                {enrichedEntries.length} entr{enrichedEntries.length === 1 ? 'y' : 'ies'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {SORTABLE_HEADERS.map((h) => (
                      <th
                        key={h.key}
                        className={`px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap ${
                          h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        <Link
                          href={getSortHref(h.key)}
                          className={`inline-flex items-center gap-1 hover:text-slate-700 ${
                            h.align === 'right' ? 'flex-row-reverse' : ''
                          }`}
                        >
                          {h.label || (h.key === 'billable' ? '$' : '')}
                          <span className="w-3 text-[10px]">{indicator(h.key)}</span>
                        </Link>
                      </th>
                    ))}
                    <th className="px-4 py-2.5" />
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
