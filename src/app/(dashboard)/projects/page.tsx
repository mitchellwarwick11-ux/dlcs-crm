import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { JOB_TYPES } from '@/lib/constants/job-types'
import { Plus, Search } from 'lucide-react'
import type { ProjectStatus } from '@/types/database'
import { stripJobNumberPrefix } from '@/lib/utils/formatters'

type SortKey = 'job_number' | 'title' | 'client' | 'project_manager' | 'type' | 'status' | 'tasks'
type SortDirection = 'asc' | 'desc'

interface ProjectRow {
  id: string
  job_number: string
  title: string
  suburb: string | null
  job_type: string
  status: ProjectStatus
  clients: {
    id: string
    name: string | null
    company_name: string | null
  } | null
  job_manager: {
    id: string
    full_name: string | null
  } | null
  project_tasks: { id: string; status: string }[]
}

function getActiveTaskCount(tasks: { status: string }[]) {
  return tasks.filter(
    (task) =>
      task.status === 'not_started' ||
      task.status === 'in_progress' ||
      task.status === 'on_hold'
  ).length
}

function getSortValue(project: ProjectRow, sort: SortKey) {
  switch (sort) {
    case 'job_number':
      return project.job_number
    case 'title':
      return project.suburb
        || stripJobNumberPrefix(project.title, project.job_number)
        || project.title
    case 'client':
      return project.clients?.company_name ?? project.clients?.name ?? ''
    case 'project_manager':
      return project.job_manager?.full_name ?? ''
    case 'type':
      return JOB_TYPES[project.job_type as keyof typeof JOB_TYPES] ?? project.job_type
    case 'status':
      return project.status
    case 'tasks':
      return getActiveTaskCount(project.project_tasks ?? [])
  }
}

function compareValues(a: string | number, b: string | number) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    type?: string
    q?: string
    hasActiveTasks?: string
    myJobs?: string
    client?: string
    pm?: string
    sort?: string
    dir?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const sort = (params.sort as SortKey | undefined) ?? 'job_number'
  const dir: SortDirection = params.dir === 'asc' ? 'asc' : 'desc'
  const hasActiveTasksOnly = params.hasActiveTasks === 'true'
  const myJobsOnly = params.myJobs === 'true'

  // Resolve the current user's staff id only when the "My Jobs" filter is on —
  // avoids an extra round-trip on every visit.
  let myStaffId: string | null = null
  if (myJobsOnly) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      const { data: myProfile } = await (supabase as any)
        .from('staff_profiles')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle()
      myStaffId = myProfile?.id ?? null
    }
  }

  let query = supabase
    .from('projects')
    .select(`
      id,
      job_number,
      title,
      suburb,
      job_type,
      status,
      clients(id, name, company_name),
      job_manager:staff_profiles!job_manager_id(id, full_name),
      project_tasks(id, status)
    `)

  if (params.status) query = query.eq('status', params.status)
  if (params.type) query = query.eq('job_type', params.type)
  if (params.q) query = query.ilike('title', `%${params.q}%`)
  if (params.client) query = query.eq('client_id', params.client)
  if (params.pm) query = query.eq('job_manager_id', params.pm)
  if (myJobsOnly) query = query.eq('job_manager_id', myStaffId ?? '00000000-0000-0000-0000-000000000000')

  const [{ data }, { data: clientOptions }, { data: pmOptions }] = await Promise.all([
    query.limit(200),
    (supabase as any)
      .from('clients')
      .select('id, name, company_name')
      .eq('is_active', true)
      .order('company_name', { ascending: true, nullsFirst: false })
      .order('name'),
    (supabase as any)
      .from('staff_profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name'),
  ])

  // Unfiltered status counts for stat tiles
  const { data: allStatuses } = await supabase.from('projects').select('status')
  const counts = {
    active: 0,
    on_hold: 0,
    completed: 0,
    total: allStatuses?.length ?? 0,
  }
  for (const row of (allStatuses ?? []) as { status: ProjectStatus }[]) {
    if (row.status === 'active') counts.active++
    else if (row.status === 'on_hold') counts.on_hold++
    else if (row.status === 'completed') counts.completed++
  }

  const projects = ((data ?? []) as ProjectRow[])
    .map((project) => ({
      ...project,
      project_tasks: project.project_tasks ?? [],
    }))
    .filter((project) => {
      if (!hasActiveTasksOnly) return true
      return getActiveTaskCount(project.project_tasks) > 0
    })
    .sort((a, b) => {
      const result = compareValues(getSortValue(a, sort), getSortValue(b, sort))
      return dir === 'asc' ? result : -result
    })

  function buildHref(next: Partial<{ sort: SortKey; dir: SortDirection }>) {
    const search = new URLSearchParams()

    if (params.q) search.set('q', params.q)
    if (params.status) search.set('status', params.status)
    if (params.type) search.set('type', params.type)
    if (params.hasActiveTasks) search.set('hasActiveTasks', params.hasActiveTasks)
    if (params.myJobs) search.set('myJobs', params.myJobs)
    if (params.client) search.set('client', params.client)
    if (params.pm) search.set('pm', params.pm)
    if (next.sort) search.set('sort', next.sort)
    if (next.dir) search.set('dir', next.dir)

    const queryString = search.toString()
    return queryString ? `/projects?${queryString}` : '/projects'
  }

  function getSortHref(column: SortKey) {
    const nextDir: SortDirection =
      sort === column && dir === 'asc' ? 'desc' : 'asc'

    return buildHref({ sort: column, dir: nextDir })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function getSortIndicator(column: SortKey) {
    if (sort !== column) return ''
    return dir === 'asc' ? '↑' : '↓'
  }

  const hasFilters = Boolean(params.status || params.type || params.q || params.hasActiveTasks || params.myJobs || params.client || params.pm)

  const SORTABLE_HEADERS: { key: SortKey; label: string; align: 'left' | 'right' | 'center' }[] = [
    { key: 'job_number',      label: 'JOB #',  align: 'left'  },
    { key: 'title',           label: 'SUBURB', align: 'left'  },
    { key: 'client',          label: 'CLIENT', align: 'left'  },
    { key: 'project_manager', label: 'PM',     align: 'left'  },
    { key: 'type',            label: 'TYPE',   align: 'left'  },
    { key: 'status',          label: 'STATUS', align: 'left'  },
    { key: 'tasks',           label: 'TASKS',  align: 'right' },
  ]

  const maxTasks = Math.max(1, ...projects.map((p) => getActiveTaskCount(p.project_tasks)))

  return (
    <div className="px-12 py-10 space-y-7">
      {/* Header */}
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold tracking-[0.16em] text-dlcs-brand">JOBS</span>
          <h1 className="text-[36px] font-bold leading-tight text-dlcs-sidebar-bg">All projects</h1>
          <p className="text-[13px] text-dlcs-ink-muted">
            {counts.active} active {counts.active === 1 ? 'job' : 'jobs'} · {projects.length} shown
          </p>
        </div>
        <Link href="/projects/new">
          <button className="inline-flex items-center gap-2 rounded-full bg-dlcs-sidebar-bg px-[18px] py-3 text-sm font-semibold text-white hover:bg-black transition-colors">
            <Plus className="h-4 w-4 text-dlcs-brand" strokeWidth={2.5} />
            New Job
          </button>
        </Link>
      </div>

      {/* Filters */}
      {(() => {
        const base = 'h-10 rounded-lg border px-3 text-sm focus:outline-none'
        const inactive = 'border-slate-200 bg-white text-slate-800'
        const active = 'border-dlcs-brand bg-dlcs-brand/10 text-slate-900 ring-1 ring-dlcs-brand/30 font-medium'
        const cls = (on: boolean, extra = '') => `${base} ${on ? active : inactive} ${extra}`
        return (
      <form method="GET" className="flex flex-wrap gap-2.5 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Search jobs, clients, addresses…"
            className={cls(!!params.q, 'w-full pl-9 placeholder:text-slate-400')}
          />
        </div>
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className={cls(!!params.status, 'cursor-pointer')}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="archived">Archived</option>
        </select>
        <select
          name="type"
          defaultValue={params.type ?? ''}
          className={cls(!!params.type, 'cursor-pointer')}
        >
          <option value="">All types</option>
          <option value="survey">Survey</option>
          <option value="sewer_water">Sewer & Water</option>
          <option value="internal">Internal</option>
        </select>
        <select
          name="client"
          defaultValue={params.client ?? ''}
          className={cls(!!params.client, 'cursor-pointer max-w-[200px]')}
        >
          <option value="">All clients</option>
          {((clientOptions ?? []) as { id: string; name: string | null; company_name: string | null }[]).map(c => (
            <option key={c.id} value={c.id}>
              {c.company_name ?? c.name ?? 'Unnamed'}
            </option>
          ))}
        </select>
        <select
          name="pm"
          defaultValue={params.pm ?? ''}
          className={cls(!!params.pm, 'cursor-pointer')}
        >
          <option value="">All PMs</option>
          {((pmOptions ?? []) as { id: string; full_name: string }[]).map(s => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
        <select
          name="hasActiveTasks"
          defaultValue={params.hasActiveTasks ?? ''}
          className={cls(!!params.hasActiveTasks, 'cursor-pointer')}
        >
          <option value="">All jobs</option>
          <option value="true">With active tasks</option>
        </select>
        <label className={cls(myJobsOnly, 'flex items-center gap-2 cursor-pointer select-none')}>
          <input
            type="checkbox"
            name="myJobs"
            value="true"
            defaultChecked={myJobsOnly}
            className="h-4 w-4 rounded border-slate-300 accent-dlcs-brand cursor-pointer"
          />
          My jobs only
        </label>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <Button type="submit" variant="outline" size="sm" className="h-10 rounded-lg">Filter</Button>
        {hasFilters && (
          <Link href={`/projects?sort=${sort}&dir=${dir}`}>
            <Button variant="ghost" size="sm" className="h-10">Clear</Button>
          </Link>
        )}
      </form>
        )
      })()}

      {/* Table */}
      {!projects.length ? (
        <div className="rounded-xl border border-dlcs-card-border bg-dlcs-card p-12 text-center">
          <p className="text-dlcs-ink-muted text-sm">No jobs found.</p>
          <Link href="/projects/new" className="inline-block mt-4">
            <Button>Create First Job</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-dlcs-card-border bg-dlcs-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-dlcs-table-head-bg">
              <tr>
                {SORTABLE_HEADERS.map((h) => (
                  <th
                    key={h.key}
                    className={`px-[22px] py-2.5 text-[11px] font-bold tracking-[0.1em] text-dlcs-ink-muted whitespace-nowrap ${
                      h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    <Link
                      href={getSortHref(h.key)}
                      className={`inline-flex items-center gap-1 hover:text-dlcs-ink ${
                        h.align === 'right' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {h.label}
                      <span className="w-3 text-[10px]">
                        {sort === h.key ? (dir === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const activeTasks = getActiveTaskCount(project.project_tasks)
                const barWidth = activeTasks > 0 ? Math.max(9, Math.round((activeTasks / maxTasks) * 60)) : 4

                return (
                  <tr key={project.id} className="border-t border-dlcs-row-divider hover:bg-dlcs-table-head-bg/60 transition-colors">
                    <td className="px-[22px] py-2.5 font-bold text-dlcs-sidebar-bg">
                      <Link href={`/projects/${project.job_number}/details`} className="hover:underline">
                        {project.job_number}
                      </Link>
                    </td>
                    <td className="px-[22px] py-2.5 text-[#1F1F22] font-medium">
                      <Link href={`/projects/${project.job_number}/details`} className="hover:underline">
                        {project.suburb
                          || stripJobNumberPrefix(project.title, project.job_number)
                          || project.title}
                      </Link>
                    </td>
                    <td className="px-[22px] py-2.5 text-dlcs-ink-soft">
                      {project.clients?.company_name ?? project.clients?.name ?? '-'}
                    </td>
                    <td className="px-[22px] py-2.5 text-dlcs-ink-soft">
                      {project.job_manager?.full_name ?? '-'}
                    </td>
                    <td className="px-[22px] py-2.5 text-dlcs-ink-soft text-[13px]">
                      {JOB_TYPES[project.job_type as keyof typeof JOB_TYPES] ?? project.job_type}
                    </td>
                    <td className="px-[22px] py-2.5">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="px-[22px] py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 rounded-sm"
                          style={{
                            width: `${barWidth}px`,
                            backgroundColor: activeTasks > 0 ? '#F39200' : '#D6D6D9',
                          }}
                        />
                        <span className="text-[13px] font-semibold text-dlcs-ink-soft">{activeTasks}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
