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

  const { data: testUsers } = await (supabase as any)
    .from('staff_profiles')
    .select('id, email, full_name, created_at')
    .eq('is_test_user', true)
    .order('created_at', { ascending: false })

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
          Create temporary logins to demo the app to people. Removing a test user here
          deletes their login immediately.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-8 text-sm text-amber-900">
        <strong className="font-medium">Heads-up:</strong> users created here can sign in
        and see the same data your account sees. Only use this for people you trust to
        view the demo data. Don&apos;t use real staff emails — manage real staff from the
        Staff page instead.
      </div>

      <TestUsersManager initialUsers={testUsers ?? []} />
    </div>
  )
}
