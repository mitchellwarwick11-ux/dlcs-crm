import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TestUsersManager } from '@/components/settings/test-users-manager'

export default async function TestUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('staff_profiles')
    .select('access_level')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.access_level !== 'admin') {
    redirect('/settings')
  }

  const db = supabase as any
  const [
    { data: testUsers },
    { data: roleRates },
  ] = await Promise.all([
    db.from('staff_profiles')
      .select('id, email, full_name, role, default_hourly_rate, access_level, created_at')
      .eq('is_test_user', true)
      .order('created_at', { ascending: false }),
    db.from('role_rates')
      .select('role_key, label, hourly_rate, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-2">
        <Link href="/settings" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Back to Settings
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Test Users</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create temporary staff logins to demo the app. They&apos;ll work like real
          staff members (with a role, rate, and access level you choose). Removing them
          here deletes their login immediately.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-8 text-sm text-amber-900">
        <strong className="font-medium">Heads-up:</strong> users created here can sign in
        and see the same data the access level allows. Don&apos;t use real staff emails —
        manage real staff from the Staff page instead.
      </div>

      <TestUsersManager initialUsers={testUsers ?? []} roleRates={roleRates ?? []} />
    </div>
  )
}
