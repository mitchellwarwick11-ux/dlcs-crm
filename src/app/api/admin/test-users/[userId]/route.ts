import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data: callerProfile } = await (supabase as any)
    .from('staff_profiles')
    .select('access_level')
    .eq('id', user.id)
    .maybeSingle()

  if (callerProfile?.access_level !== 'admin') {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  }

  const { userId } = await params

  if (userId === user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account here' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Only allow deleting users that were created via the Test Users page.
  const { data: target } = await (admin as any)
    .from('staff_profiles')
    .select('id, is_test_user')
    .eq('id', userId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (!target.is_test_user) {
    return NextResponse.json(
      { error: 'This user is not flagged as a test user. Delete real staff via the Staff page.' },
      { status: 400 }
    )
  }

  // Deleting the auth user cascades to staff_profiles via the FK.
  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
