import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '@/components/clients/client-form'

export default async function NewClientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New Client</h1>
        <p className="text-sm text-slate-500 mt-1">Add a new client to the system.</p>
      </div>
      <ClientForm mode="create" />
    </div>
  )
}
