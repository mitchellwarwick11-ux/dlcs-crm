import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { JOB_TYPES } from '@/lib/constants/job-types'
import { Plus } from 'lucide-react'
import type { ProjectStatus } from '@/types/database'

type SortKey = 'job_number' | 'title' | 'client' | 'project_manager' | 'type' | 'status' | 'tasks'
type SortDirection = 'asc' | 'desc'

interface ProjectRow {
  id: string
  job_number: string
  title: string
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
      return project.title
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
    sort?: string
    dir?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const sort = (params.sort as SortKey | undefined) ?? 'job_number'
  const dir: SortDirection = params.dir === 'asc' ? 'asc' : 'desc'
  const hasActiveTasksOnly = params.hasActiveTasks === 'true'

  let query = supabase
    .from('projects')
    .select(`
      id,
      job_number,
      title,
      job_type,
      status,
      clients(id, name, company_name),
      job_manager:staff_profiles!job_manager_id(id, full_name),
      project_tasks(id, status)
    `)

  if (params.status) query = query.eq('status', params.status)
  if (params.type) query = query.eq('job_type', params.type)
  if (params.q) query = query.ilike('title', `%${params.q}%`)

  const { data } = await query.limit(200)

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

  const hasFilters = Boolean(params.status || params.type || params.q || params.hasActiveTasks)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Jobs</h1>
          <p className="text-sm text-slate-500 mt-1">{projects?.length ?? 0} jobs</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <form method="GET" className="flex gap-2 flex-wrap">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Search jobs…"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-48"
          />
          <select
            name="status"
            defaultValue={params.status ?? ''}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
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
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All types</option>
            <option value="survey">Survey</option>
            <option value="sewer_water">Sewer & Water</option>
            <option value="internal">Internal</option>
          </select>
          <select
            name="hasActiveTasks"
            defaultValue={params.hasActiveTasks ?? ''}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All jobs</option>
            <option value="true">With active tasks</option>
          </select>
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <Button type="submit" variant="outline" size="sm">Filter</Button>
          {hasFilters && (
            <Link href={`/projects?sort=${sort}&dir=${dir}`}>
              <Button variant="ghost" size="sm">Clear</Button>
            </Link>
          )}
        </form>
      </div>

      {/* Table */}
      {!projects.length ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 text-sm">No jobs found.</p>
          <Link href="/projects/new" className="inline-block mt-4">
            <Button>Create First Job</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  { key: 'job_number' as const, label: 'Job #' },
                  { key: 'title' as const, label: 'Title' },
                  { key: 'client' as const, label: 'Client' },
                  { key: 'project_manager' as const, label: 'Project Manager' },
                  { key: 'type' as const, label: 'Type' },
                  { key: 'status' as const, label: 'Status' },
                  { key: 'tasks' as const, label: 'Tasks' },
                ].map((column) => (
                  <th key={column.key} className="text-left px-4 py-3 font-medium text-slate-600">
                    <Link
                      href={getSortHref(column.key)}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      {column.label}
                      <span className="w-3 text-xs text-slate-400">
                        {sort === column.key ? (dir === 'asc' ? '^' : 'v') : ''}
                      </span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((project) => {
                const activeTasks = getActiveTaskCount(project.project_tasks)

                return (
                  <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">
                      <Link href={`/projects/${project.job_number}/details`} className="hover:underline">
                        {project.job_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-900">
                      <Link href={`/projects/${project.job_number}/details`} className="hover:underline">
                        {project.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {project.clients?.company_name ?? project.clients?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {project.job_manager?.full_name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {JOB_TYPES[project.job_type as keyof typeof JOB_TYPES] ?? project.job_type}
                    </td>
                    <td className="px-4 py-3">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="px-4 py-3">
                      {activeTasks > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                          {activeTasks} active
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
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
