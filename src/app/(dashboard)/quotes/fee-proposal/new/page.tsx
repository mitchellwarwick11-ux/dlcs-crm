import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FeeProposalForm } from '@/components/quotes/fee-proposal-form'
import type { FeeProposalTemplate, GenericNote, RoleRate } from '@/types/database'

export default async function NewFeeProposalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const [{ data: clients }, { data: projects }, { data: templates }, { data: genericNotes }, { data: roleRates }] = await Promise.all([
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

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden">
      <FeeProposalForm
        clients={clients ?? []}
        projects={projects ?? []}
        templates={(templates ?? []) as FeeProposalTemplate[]}
        genericNotes={(genericNotes ?? []) as GenericNote[]}
        roleRates={(roleRates ?? []) as RoleRate[]}
      />
    </div>
  )
}
