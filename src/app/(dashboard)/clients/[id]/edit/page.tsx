import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '@/components/clients/client-form'

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: client } = await (supabase as any)
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) notFound()

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Edit Client</h1>
        <p className="text-sm text-slate-500 mt-1">{client.company_name ?? client.name}</p>
      </div>
      <ClientForm
        mode="edit"
        clientId={id}
        initialValues={{
          name: client.name,
          company_name: client.company_name ?? '',
          email: client.email ?? '',
          phone: client.phone ?? '',
          address_line1: client.address_line1 ?? '',
          address_line2: client.address_line2 ?? '',
          suburb: client.suburb ?? '',
          state: client.state ?? 'NSW',
          postcode: client.postcode ?? '',
          notes: client.notes ?? '',
          is_active: client.is_active,
        }}
      />
    </div>
  )
}
