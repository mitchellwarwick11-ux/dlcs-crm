import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GlobalQuoteForm } from '@/components/quotes/global-quote-form'

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ related_job?: string }>
}) {
  const params  = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const [{ data: projects }, { data: clients }] = await Promise.all([
    db
      .from('projects')
      .select('id, job_number, title, client_id')
      .in('status', ['active', 'on_hold'])
      .order('job_number', { ascending: false }),
    db
      .from('clients')
      .select('id, name, company_name, email, phone, address_line1, suburb')
      .eq('is_active', true)
      .order('name'),
  ])

  // If ?related_job=26001, find that project's id to pre-select
  let initialProjectId: string | undefined
  if (params.related_job) {
    const match = (projects ?? []).find((p: any) => p.job_number === params.related_job)
    initialProjectId = match?.id
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">New Quote</h1>
      <GlobalQuoteForm
        projects={projects ?? []}
        clients={clients ?? []}
        initialProjectId={initialProjectId}
      />
    </div>
  )
}
