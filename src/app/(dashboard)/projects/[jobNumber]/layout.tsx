import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectTabs } from '@/components/projects/project-tabs'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { JOB_TYPES } from '@/lib/constants/job-types'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import type { JobType, ProjectStatus } from '@/types/database'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ jobNumber: string }>
}) {
  const { jobNumber } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const { data: project } = await supabase
    .from('projects')
    .select('*, clients(name, company_name)')
    .eq('job_number', jobNumber)
    .returns<any[]>()
    .single()

  if (!project) notFound()

  const p = project as any

  // Fetch task progress using project id
  const { data: taskList } = await db
    .from('project_tasks')
    .select('id, status')
    .eq('project_id', p.id)

  const totalTasks = taskList?.length ?? 0
  const completedTasks = taskList?.filter((t: any) => t.status === 'completed').length ?? 0
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const clientName = p.clients?.company_name ?? p.clients?.name ?? null

  return (
    <div className="flex flex-col min-h-full">
      {/* Project header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-lg font-bold text-slate-900">{p.job_number}</span>
              <ProjectStatusBadge status={p.status as ProjectStatus} />
              <span className="text-sm text-slate-400">{JOB_TYPES[p.job_type as JobType]}</span>
            </div>
            <h1 className="text-xl font-semibold text-slate-800 mt-1">{p.title}</h1>
            {clientName && <p className="text-sm text-slate-500 mt-0.5">{clientName}</p>}

            {/* Task progress bar */}
            {totalTasks > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 max-w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {completedTasks}/{totalTasks} task{totalTasks !== 1 ? 's' : ''} complete
                </span>
              </div>
            )}
          </div>

          <Link href={`/projects/${jobNumber}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4 mr-2" />
              Edit Job
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <ProjectTabs jobNumber={jobNumber} />

      {/* Tab content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
