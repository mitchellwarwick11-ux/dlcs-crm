import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, Info } from 'lucide-react'
import { InteractiveChecklist } from '@/components/field/interactive-checklist'

export default async function ChecklistPage({
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
  if (!staffProfile) redirect('/field')

  const { data: entry } = await db
    .from('field_schedule_entries')
    .select(`
      id, project_id, task_id,
      projects ( id, job_number ),
      project_tasks ( id, title, task_definition_id )
    `)
    .eq('id', entryId)
    .maybeSingle()
  if (!entry) notFound()

  const proj = entry.projects
  const taskDefinitionId: string | null = entry.project_tasks?.task_definition_id ?? null

  const { data: checklists } = taskDefinitionId
    ? await db
        .from('checklist_templates')
        .select('id, title, items')
        .eq('is_active', true)
        .eq('task_definition_id', taskDefinitionId)
        .order('sort_order')
    : { data: [] as { id: string; title: string; items: { id: string; text: string }[] }[] }

  // Load any existing submission across all surveyors on this entry, since
  // one surveyor's submission counts for the whole entry. Display the latest
  // submission's responses so re-opens look correct regardless of who saved.
  const submissionsByTemplate: Record<string, { responses: any[]; submitted_at: string | null }> = {}
  if (checklists && checklists.length > 0) {
    const { data: subs } = await db
      .from('checklist_submissions')
      .select('template_id, responses, submitted_at, completed_at')
      .eq('entry_id', entryId)
      .in('template_id', checklists.map((c: any) => c.id))
      .order('completed_at', { ascending: false })

    for (const s of (subs ?? [])) {
      if (!submissionsByTemplate[s.template_id]) {
        submissionsByTemplate[s.template_id] = {
          responses: Array.isArray(s.responses) ? s.responses : [],
          submitted_at: s.submitted_at ?? null,
        }
      }
    }
  }

  const jobLabel = proj?.job_number ?? entryId.slice(0, 8)

  return (
    <div className="flex flex-col flex-1 bg-[#E8E5DC]">
      {/* Header */}
      <div className="bg-[#1A1A1E] px-4 pt-safe-top">
        <div className="flex items-center gap-2 py-3">
          <Link
            href={`/field/${entryId}`}
            className="p-1.5 -ml-1.5 rounded-lg text-[#BDBDC0] hover:bg-[#45454B] transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#F39200] font-bold tracking-[0.18em]">{jobLabel}</p>
            <h1 className="text-base font-bold text-white">Checklist</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {checklists && checklists.length > 0 ? (
          checklists.map((cl: any) => {
            const sub = submissionsByTemplate[cl.id]
            return (
              <InteractiveChecklist
                key={cl.id}
                entryId={entryId}
                staffId={staffProfile.id}
                templateId={cl.id}
                title={cl.title}
                items={cl.items}
                initialResponses={sub?.responses ?? []}
                initiallySubmittedAt={sub?.submitted_at ?? null}
              />
            )
          })
        ) : (
          <div className="flex items-start gap-3 p-4 bg-white border border-[#D6D2C7] rounded-xl">
            <Info className="h-4 w-4 text-[#9A9A9C] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#4B4B4F]">No checklist for this task type</p>
              <p className="text-xs text-[#9A9A9C] mt-0.5">
                There is no checklist template configured for this job. Nothing to complete here.
              </p>
            </div>
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  )
}
