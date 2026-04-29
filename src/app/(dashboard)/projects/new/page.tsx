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
    state: string | null
    postcode: string | null
    lotNumber: string | null
    sectionNumber: string | null
    planNumber: string | null
    lga: string | null
    parish: string | null
    county: string | null
    jobType: string | null
    lineItems: { description: string; amount: number }[]
  } | null = null

  if (params.from_quote) {
    const { data: quote } = await db
      .from('quotes')
      .select(`
        id, client_id, contact_name, contact_phone, contact_email,
        site_address, suburb, state, postcode,
        lot_number, section_number, plan_number,
        lga, parish, county,
        job_type, subtotal, selected_quote_tasks
      `)
      .eq('id', params.from_quote)
      .single()

    const { data: quoteItems } = await db
      .from('quote_items')
      .select('description, amount')
      .eq('quote_id', params.from_quote)
      .order('sort_order')

    if (quote) {
      // Fee-proposal quotes store tasks in `selected_quote_tasks` (authoritative).
      // Legacy global-quote-form quotes use `quote_items` rows. Fall back to
      // job_type + subtotal if both are empty.
      const quoteTasks = Array.isArray(quote.selected_quote_tasks) ? quote.selected_quote_tasks : []
      const fetchedItems = (quoteItems ?? []) as { description: string; amount: number }[]

      let lineItems: { description: string; amount: number }[]
      if (quoteTasks.length > 0) {
        lineItems = quoteTasks.map((t: any) => ({
          description: String(t.title ?? '').trim() || 'Quote Task',
          amount:      Number(t.price) || 0,
        }))
      } else if (fetchedItems.length > 0) {
        lineItems = fetchedItems
      } else if (quote.job_type) {
        lineItems = [{ description: quote.job_type, amount: quote.subtotal ?? 0 }]
      } else {
        lineItems = []
      }

      quotePrefill = {
        quoteId:       quote.id,
        clientId:      quote.client_id,
        contactName:   quote.contact_name,
        contactPhone:  quote.contact_phone,
        contactEmail:  quote.contact_email,
        siteAddress:   quote.site_address,
        suburb:        quote.suburb,
        state:         quote.state,
        postcode:      quote.postcode,
        lotNumber:     quote.lot_number,
        sectionNumber: quote.section_number,
        planNumber:    quote.plan_number,
        lga:           quote.lga,
        parish:        quote.parish,
        county:        quote.county,
        jobType:       quote.job_type,
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
