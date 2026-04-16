import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GlobalQuoteForm } from '@/components/quotes/global-quote-form'

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ quoteId: string }>
}) {
  const { quoteId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const [{ data: quote }, { data: projects }, { data: clients }] = await Promise.all([
    db
      .from('quotes')
      .select(`
        id, quote_number, status, project_id, client_id,
        contact_name, contact_phone, contact_email,
        site_address, suburb, lot_number, plan_number, job_type,
        notes, valid_until
      `)
      .eq('id', quoteId)
      .single(),
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

  if (!quote) notFound()

  // Accepted/cancelled quotes cannot be edited
  if (quote.status === 'accepted' || quote.status === 'cancelled') {
    redirect(`/quotes/${quoteId}`)
  }

  const { data: items } = await db
    .from('quote_items')
    .select('id, description, quantity, unit_price, amount, sort_order')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true })

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Edit {quote.quote_number}</h1>
      <GlobalQuoteForm
        projects={projects ?? []}
        clients={clients ?? []}
        quote={{ ...quote, items: items ?? [] }}
      />
    </div>
  )
}
