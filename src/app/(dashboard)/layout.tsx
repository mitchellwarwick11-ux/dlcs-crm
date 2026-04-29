import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { VIEW_AS_COOKIE } from '@/lib/preview-role'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const db = supabase as any
  const cookieStore = await cookies()

  // Find the logged-in user's staff profile
  const { data: myProfile } = await db
    .from('staff_profiles')
    .select('id, full_name, access_level')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()

  // Determine which staff member we're viewing as (defaults to own profile)
  const viewAsId = cookieStore.get(VIEW_AS_COOKIE)?.value ?? myProfile?.id
  let viewAsProfile = myProfile

  if (viewAsId && myProfile && viewAsId !== myProfile.id) {
    const { data: other } = await db
      .from('staff_profiles')
      .select('id, full_name, access_level')
      .eq('id', viewAsId)
      .maybeSingle()
    if (other) viewAsProfile = other
  }

  // Fetch all staff for the "Viewing as" switcher (available to all logged-in users during development)
  const allStaff = ((await db
    .from('staff_profiles')
    .select('id, full_name, access_level')
    .eq('is_active', true)
    .order('full_name')).data ?? [])

  return (
    <div className="min-h-screen bg-dlcs-canvas text-dlcs-ink">
      <Sidebar
        myProfile={myProfile ?? null}
        viewAsProfile={viewAsProfile ?? null}
        allStaff={allStaff}
      />
      <main className="ml-60 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
