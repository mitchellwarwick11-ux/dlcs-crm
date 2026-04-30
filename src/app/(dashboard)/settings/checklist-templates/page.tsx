import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ChecklistTemplatesManager } from '@/components/settings/checklist-templates-manager'

export default async function ChecklistTemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const [{ data: templates }, { data: taskDefs }] = await Promise.all([
    db.from('checklist_templates')
      .select('id, title, items, task_definition_id, is_active, sort_order')
      .order('sort_order'),
    db.from('task_definitions')
      .select('id, name, applicable_job_type, is_active')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-3"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Checklist Templates</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create one checklist per task type. The checklist will be shown to the
          field surveyor in the Job Brief &amp; Checklists section of the Field App
          when that task type is on a scheduled job.
        </p>
      </div>

      <ChecklistTemplatesManager
        initialTemplates={templates ?? []}
        taskDefinitions={taskDefs ?? []}
      />
    </div>
  )
}
