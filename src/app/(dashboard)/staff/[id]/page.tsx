import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

export default async function StaffDetailPage({
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
    db.from('role_rates').select('role_key, label, hourly_rate').eq('is_active', true),
  ])

  if (!staff) notFound()

  const roleMap: Record<string, string> = {}
  for (const r of (roleRates ?? [])) roleMap[r.role_key] = r.label

  const roleLabel = roleMap[staff.role] ?? staff.role
  const isRateOverridden = roleRates?.find((r: any) => r.role_key === staff.role)?.hourly_rate !== staff.default_hourly_rate

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center">
            <span className="text-lg font-semibold text-slate-600">
              {staff.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{staff.full_name}</h1>
            <p className="text-sm text-slate-500">{roleLabel}</p>
            {!staff.is_active && (
              <span className="inline-block mt-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>
            )}
          </div>
        </div>
        <Link href={`/staff/${id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">Email</p>
            <a href={`mailto:${staff.email}`} className="text-sm text-blue-600 hover:underline">{staff.email}</a>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">Role</p>
            <p className="text-sm text-slate-900">{roleLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">Hourly Rate</p>
            <p className="text-sm text-slate-900 font-medium">
              ${Number(staff.default_hourly_rate).toFixed(2)}/hr
              {isRateOverridden && (
                <span className="ml-2 text-xs text-amber-600 font-normal">(custom rate)</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">Status</p>
            <p className="text-sm text-slate-900">{staff.is_active ? 'Active' : 'Inactive'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
