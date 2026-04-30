import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  }
  const { data: profile } = await (supabase as any)
    .from('staff_profiles')
    .select('access_level')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.access_level !== 'admin') {
    return { error: NextResponse.json({ error: 'Admins only' }, { status: 403 }) }
  }
  return { user }
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  let body: { email?: string; password?: string; full_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password ?? ''
  const fullName = body.full_name?.trim() || (email ? email.split('@')[0] : 'Test User')

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message ?? 'Failed to create user' },
      { status: 400 }
    )
  }

  // The handle_new_user trigger has already inserted a staff_profiles row.
  // Mark it as a test user and set the supplied display name.
  const { error: profileErr } = await (admin as any)
    .from('staff_profiles')
    .update({ is_test_user: true, full_name: fullName })
    .eq('id', created.user.id)

  if (profileErr) {
    // Roll back the auth user so we don't leave orphans.
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json(
      { error: `Created auth user but failed to flag profile: ${profileErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    id: created.user.id,
    email: created.user.email,
    full_name: fullName,
  })
}

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const admin = createAdminClient()

  const { data: profiles, error } = await (admin as any)
    .from('staff_profiles')
    .select('id, email, full_name, created_at')
    .eq('is_test_user', true)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: profiles ?? [] })
}
