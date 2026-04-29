import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'DLCS Field App',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    // Full-height white card centred on larger screens, full-width on mobile
    <div className="min-h-screen bg-[#2F2F33]">
      <div className="max-w-lg mx-auto min-h-screen bg-[#F5F4F1] flex flex-col shadow-sm">
        {children}
      </div>
    </div>
  )
}
