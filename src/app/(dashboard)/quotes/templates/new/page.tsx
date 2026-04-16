import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplateForm } from '@/components/quotes/template-form'

export default async function NewTemplatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New Template</h1>
        <p className="text-sm text-slate-500 mt-0.5">Create a reusable fee proposal template.</p>
      </div>
      <TemplateForm />
    </div>
  )
}
