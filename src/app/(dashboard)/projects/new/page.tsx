import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectForm } from '@/components/projects/project-form'

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams?: Promise<{ from_quote?: string }>
}) {
  const params  = searchParams ? await searchParams : {}
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const [{ data: taskDefinitions }, { data: clients }, { data: staff }] = await Promise.all([
    supabase.from('task_definitions').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('clients').select('*').eq('is_active', true).order('name'),
    supabase.from('staff_profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
  ])

  // If coming from a quote acceptance, fetch the quote to pre-fill the form
  let quotePrefill: {
    quoteId: string
    clientId: string | null
    contactName: string | null
    contactPhone: string | null
    contactEmail: string | null
    siteAddress: string | null
    suburb: string | null
    lotNumber: string | null
    planNumber: string | null
    jobType: string | null
    lineItems: { description: string; amount: number }[]
  } | null = null

  if (params.from_quote) {
    const { data: quote } = await db
      .from('quotes')
      .select(`
        id, client_id, contact_name, contact_phone, contact_email,
        site_address, suburb, lot_number, plan_number, job_type, subtotal
      `)
      .eq('id', params.from_quote)
      .single()

    const { data: quoteItems } = await db
      .from('quote_items')
      .select('description, amount')
      .eq('quote_id', params.from_quote)
      .order('sort_order')

    if (quote) {
      const fetchedItems = (quoteItems ?? []) as { description: string; amount: number }[]

      // Fallback: if no line items were stored, synthesise one from the quote's job_type + subtotal
      const lineItems = fetchedItems.length > 0
        ? fetchedItems
        : quote.job_type
          ? [{ description: quote.job_type, amount: quote.subtotal ?? 0 }]
          : []

      quotePrefill = {
        quoteId:      quote.id,
        clientId:     quote.client_id,
        contactName:  quote.contact_name,
        contactPhone: quote.contact_phone,
        contactEmail: quote.contact_email,
        siteAddress:  quote.site_address,
        suburb:       quote.suburb,
        lotNumber:    quote.lot_number,
        planNumber:   quote.plan_number,
        jobType:      quote.job_type,
        lineItems,
      }
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New Job</h1>
        {quotePrefill
          ? <p className="text-sm text-slate-500 mt-1">Pre-filled from quote acceptance. Review the details below, then create the job.</p>
          : <p className="text-sm text-slate-500 mt-1">A job number will be assigned automatically.</p>}
      </div>
      <ProjectForm
        taskDefinitions={taskDefinitions ?? []}
        clients={clients ?? []}
        staff={staff ?? []}
        userId={user.id}
        quotePrefill={quotePrefill}
      />
    </div>
  )
}
