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
    <div className="flex flex-col flex-1 bg-[#F5F4F1]">
      {/* Header — charcoal */}
      <div className="bg-[#2F2F33] px-4 pt-safe-top">
        <div className="flex items-center gap-2 py-3">
          <Link
            href={`/field/${entryId}`}
            className="p-1.5 -ml-1.5 rounded-lg text-[#BDBDC0] hover:bg-[#45454B] transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#F39200] font-bold tracking-[0.18em]">{jobLabel}</p>
            <h1 className="text-base font-bold text-white">Job Brief</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

        {/* Brief content */}
        {brief ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase">
                {taskBrief ? 'Task Brief' : 'Project Brief'}
              </p>
              <p className="text-[10px] text-[#9A9A9C]">
                Updated {format(new Date(brief.updated_at), 'd MMM yyyy')}
              </p>
            </div>
            <div className="bg-white border border-[#E8E6E0] rounded-xl p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-[3px] h-5 bg-[#F39200]" />
                <p className="text-[15px] font-bold text-[#111111]">{taskBrief ? 'Task Brief' : 'Project Brief'}</p>
              </div>
              <p className="text-[13px] text-[#4B4B4F] whitespace-pre-wrap leading-relaxed">{brief.content}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-white border border-[#E8E6E0] rounded-xl">
            <Info className="h-4 w-4 text-[#9A9A9C] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#4B4B4F]">No brief provided</p>
              <p className="text-xs text-[#9A9A9C] mt-0.5">
                Your Project Manager has not added a brief for this job yet.
                Check with them directly if you need specific instructions.
              </p>
            </div>
          </div>
        )}

        {/* Checklists */}
        {checklists && checklists.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-2">Checklists</p>
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
    <div className="bg-white border border-[#E8E6E0] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-[#FAF8F3] border-b border-[#EFEDE6]">
        <div className="w-[3px] h-3.5 bg-[#F39200]" />
        <p className="text-[13px] font-bold text-[#111111] flex-1">{title}</p>
        <p className="text-[11px] font-bold text-[#6B6B6F]">0 / {items.length}</p>
      </div>
      <div>
        {items.map((item, idx) => (
          <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-[#EFEDE6]' : ''}`}>
            <div className="h-[18px] w-[18px] rounded-[5px] border-[1.5px] border-[#CFCDC5] bg-white shrink-0" />
            <span className="text-[13px] text-[#4B4B4F]">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
