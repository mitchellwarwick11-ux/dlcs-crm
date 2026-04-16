import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StaffForm } from '@/components/staff/staff-form'

export default async function NewStaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleRates } = await (supabase as any)
    .from('role_rates')
    .select('*')
    .order('sort_order')

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Add Staff Member</h1>
        <p className="text-sm text-slate-500 mt-1">Add a new person to the team.</p>
      </div>
      <StaffForm mode="create" roleRates={roleRates ?? []} />
    </div>
  )
}
