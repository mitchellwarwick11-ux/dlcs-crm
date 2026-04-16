import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvoiceForm } from '@/components/invoices/invoice-form'

export default async function NewInvoicePage({
  params,
}: {
  params: Promise<{ jobNumber: string }>
}) {
  const { jobNumber } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const { data: project } = await db
    .from('projects')
    .select('id, title, clients ( name, company_name, email, phone )')
    .eq('job_number', jobNumber)
    .single()

  if (!project) notFound()

  const p = project as any

  // Tasks (not cancelled)
  const { data: tasks } = await db
    .from('project_tasks')
    .select('id, title, fee_type, quoted_amount, claimed_amount, status, sort_order')
    .eq('project_id', p.id)
    .not('status', 'eq', 'cancelled')
    .not('fee_type', 'eq', 'non_billable')
    .order('sort_order')

  // Uninvoiced billable time entries that are linked to a task
  const { data: timeEntries } = await db
    .from('time_entries')
    .select(`
      id, task_id, date, hours, rate_at_time, description,
      staff_profiles ( full_name )
    `)
    .eq('project_id', p.id)
    .is('invoice_item_id', null)
    .eq('is_billable', true)
    .not('task_id', 'is', null)
    .order('date', { ascending: true })

  // Uninvoiced cost items
  const { data: costs } = await db
    .from('project_costs')
    .select('id, description, amount, has_gst, date')
    .eq('project_id', p.id)
    .is('invoice_item_id', null)
    .order('created_at', { ascending: true })

  // Accepted quote for contact prefill
  const { data: quote } = await db
    .from('quotes')
    .select('id, contact_name, contact_email, contact_phone')
    .eq('project_id', p.id)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prefill = {
    contactName: quote?.contact_name ?? p.clients?.name ?? '',
    contactEmail: quote?.contact_email ?? p.clients?.email ?? '',
  }

  return (
    <div>
      <div className="px-8 pt-6 pb-0">
        <h2 className="text-base font-semibold text-slate-900">New Invoice</h2>
        <p className="text-sm text-slate-500 mt-0.5">Select tasks to include and configure each claim.</p>
      </div>
      <InvoiceForm
        jobNumber={jobNumber}
        projectId={p.id}
        quoteId={quote?.id ?? null}
        tasks={tasks ?? []}
        timeEntries={timeEntries ?? []}
        costs={costs ?? []}
        prefill={prefill}
      />
    </div>
  )
}
