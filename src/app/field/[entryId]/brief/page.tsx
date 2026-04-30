import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, BookOpen, Info } from 'lucide-react'
import { InteractiveChecklist } from '@/components/field/interactive-checklist'

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

  const { data: staffProfile } = await db
    .from('staff_profiles')
    .select('id')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()

  const { data: entry } = await db
    .from('field_schedule_entries')
    .select(`
      id, date, project_id, task_id,
      projects ( id, job_number, site_address, suburb, job_type ),
      project_tasks ( id, title, task_definition_id )
    `)
    .eq('id', entryId)
    .maybeSingle()

  if (!entry) notFound()

  const proj = entry.projects
  const taskDefinitionId: string | null = entry.project_tasks?.task_definition_id ?? null

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

  // Fetch the checklist template for this entry's task type (one per task type).
  const { data: checklists } = taskDefinitionId
    ? await db
        .from('checklist_templates')
        .select('id, title, items')
        .eq('is_active', true)
        .eq('task_definition_id', taskDefinitionId)
        .order('sort_order')
    : { data: [] as { id: string; title: string; items: { id: string; text: string }[] }[] }

  // Fetch any existing checklist submissions for this surveyor on this entry,
  // so previously ticked items show ticked.
  const submissionsByTemplate: Record<string, string[]> = {}
  if (staffProfile && checklists && checklists.length > 0) {
    const { data: subs } = await db
      .from('checklist_submissions')
      .select('template_id, checked_items')
      .eq('entry_id', entryId)
      .eq('staff_id', staffProfile.id)
      .in('template_id', checklists.map((c: any) => c.id))
    for (const s of (subs ?? [])) {
      submissionsByTemplate[s.template_id] = s.checked_items ?? []
    }
  }

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
        {checklists && checklists.length > 0 && staffProfile && (
          <div>
            <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-2">Checklists</p>
            <div className="space-y-3">
              {checklists.map((cl: any) => (
                <InteractiveChecklist
                  key={cl.id}
                  entryId={entryId}
                  staffId={staffProfile.id}
                  templateId={cl.id}
                  title={cl.title}
                  items={cl.items}
                  initialChecked={submissionsByTemplate[cl.id] ?? []}
                />
              ))}
            </div>
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  )
}

