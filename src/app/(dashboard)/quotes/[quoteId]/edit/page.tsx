import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FeeProposalForm } from '@/components/quotes/fee-proposal-form'
import type { FeeProposalTemplate, GenericNote, RoleRate } from '@/types/database'

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

  const [
    { data: quote },
    { data: clients },
    { data: projects },
    { data: templates },
    { data: genericNotes },
    { data: roleRates },
  ] = await Promise.all([
    db
      .from('quotes')
      .select(`
        id, status,
        client_id, project_id,
        contact_name, contact_phone, contact_email,
        site_address, suburb, state, postcode,
        lot_number, section_number, plan_number,
        lga, parish, county,
        selected_quote_tasks, selected_note_items, selected_role_keys,
        valid_until
      `)
      .eq('id', quoteId)
      .single(),
    db.from('clients').select('*').eq('is_active', true).order('name'),
    db
      .from('projects')
      .select('id, job_number, title, client_id, site_address, suburb, state, postcode, lot_number, section_number, plan_number, lga, parish, county')
      .in('status', ['active', 'on_hold'])
      .order('job_number', { ascending: false }),
    db
      .from('fee_proposal_templates')
      .select('*')
      .eq('is_active', true)
      .order('label'),
    db
      .from('generic_notes')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
    db
      .from('role_rates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  if (!quote) notFound()

  if (quote.status === 'accepted' || quote.status === 'cancelled') {
    redirect(`/quotes/${quoteId}`)
  }

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden">
      <FeeProposalForm
        clients={clients ?? []}
        projects={projects ?? []}
        templates={(templates ?? []) as FeeProposalTemplate[]}
        genericNotes={(genericNotes ?? []) as GenericNote[]}
        roleRates={(roleRates ?? []) as RoleRate[]}
        quote={quote}
      />
    </div>
  )
}
