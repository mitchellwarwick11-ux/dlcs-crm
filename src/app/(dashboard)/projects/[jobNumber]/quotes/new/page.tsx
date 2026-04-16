import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuoteForm } from '@/components/quotes/quote-form'

export default async function NewQuotePage({
  params,
}: {
  params: Promise<{ jobNumber: string }>
}) {
  const { jobNumber } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('job_number', jobNumber)
    .returns<any[]>()
    .single()

  if (!project) notFound()

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-base font-semibold text-slate-900 mb-6">New Quote</h2>
      <QuoteForm projectId={(project as any).id} jobNumber={jobNumber} />
    </div>
  )
}
