import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, BookOpen, Info } from 'lucide-react'

export default async function JobBriefPage({
  params,
}: {
  params: Promise<{ entryId: string }>
}) {
  const { entryId } = await params
  const supabase = await createClient()
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entry } = await db
    .from('field_schedule_entries')
    .select(`
      id, date, project_id, task_id,
      projects ( id, job_number, site_address, suburb, job_type ),
      project_tasks ( id, title )
    `)
    .eq('id', entryId)
    .maybeSingle()

  if (!entry) notFound()

  const proj = entry.projects

  // Look for a task-specific brief first, then a project-level brief
  const [{ data: taskBrief }, { data: projectBrief }] = await Promise.all([
    entry.task_id
      ? db.from('job_briefs').select('id, content, updated_at')
          .eq('project_id', entry.project_id)
          .eq('task_id', entry.task_id)
          .maybeSingle()
      : { data: null },

    db.from('job_briefs').select('id, content, updated_at')
      .eq('project_id', entry.project_id)
      .is('task_id', null)
      .maybeSingle(),
  ])

  // Fetch applicable checklists for this job type
  const { data: checklists } = await db
    .from('checklist_templates')
    .select('id, title, items')
    .eq('is_active', true)
    .or(`job_type.is.null,job_type.eq.${proj?.job_type ?? 'survey'}`)
    .order('sort_order')

  const brief    = taskBrief ?? projectBrief
  const jobLabel = proj?.job_number ?? entryId.slice(0, 8)

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-safe-top">
        <div className="flex items-center gap-2 py-3">
          <Link
            href={`/field/${entryId}`}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <BookOpen className="h-5 w-5 text-purple-500 shrink-0" />
            <div>
              <p className="text-xs text-slate-500 font-medium">{jobLabel}</p>
              <h1 className="text-base font-bold text-slate-900">Job Brief</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">

        {/* Brief content */}
        {brief ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {taskBrief ? 'Task Brief' : 'Project Brief'}
              </p>
              <p className="text-xs text-slate-400">
                Updated {format(new Date(brief.updated_at), 'd MMM yyyy')}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{brief.content}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <Info className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-600">No brief provided</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Your Project Manager has not added a brief for this job yet.
                Check with them directly if you need specific instructions.
              </p>
            </div>
          </div>
        )}

        {/* Checklists */}
        {checklists && checklists.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Checklists</p>
            <div className="space-y-3">
              {checklists.map((cl: any) => (
                <ChecklistCard key={cl.id} title={cl.title} items={cl.items} />
              ))}
            </div>
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  )
}

function ChecklistCard({ title, items }: { title: string; items: { id: string; text: string }[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
      </div>
      <div className="divide-y divide-slate-50">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3">
            <div className="h-5 w-5 rounded border-2 border-slate-300 shrink-0" />
            <span className="text-sm text-slate-700">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
