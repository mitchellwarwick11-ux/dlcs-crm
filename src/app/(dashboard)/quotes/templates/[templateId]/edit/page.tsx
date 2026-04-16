import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplateForm } from '@/components/quotes/template-form'
import type { FeeProposalTemplate } from '@/types/database'

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>
}) {
  const { templateId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any
  const { data: template } = await db
    .from('fee_proposal_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (!template) notFound()

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Edit Template</h1>
        <p className="text-sm text-slate-500 mt-0.5">{(template as FeeProposalTemplate).label}</p>
      </div>
      <TemplateForm template={template as FeeProposalTemplate} />
    </div>
  )
}
