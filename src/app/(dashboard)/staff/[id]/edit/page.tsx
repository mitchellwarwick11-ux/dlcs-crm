import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StaffForm } from '@/components/staff/staff-form'

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const [{ data: staff }, { data: roleRates }] = await Promise.all([
    db.from('staff_profiles').select('*').eq('id', id).single(),
    db.from('role_rates').select('*').order('sort_order'),
  ])

  if (!staff) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Edit Staff Member</h1>
        <p className="text-sm text-slate-500 mt-1">{staff.full_name}</p>
      </div>
      <StaffForm
        mode="edit"
        staffId={id}
        roleRates={roleRates ?? []}
        initialValues={{
          full_name: staff.full_name,
          email: staff.email,
          role_key: staff.role,
          hourly_rate: staff.default_hourly_rate,
          is_active: staff.is_active,
          access_level: staff.access_level ?? 'staff',
        }}
      />
    </div>
  )
}
