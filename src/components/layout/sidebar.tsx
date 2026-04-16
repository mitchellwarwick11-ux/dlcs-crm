'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FolderOpen,
  FileText,
  Users,
  HardHat,
  Settings,
  LogOut,
  ChevronRight,
  Clock,
  BarChart2,
  CalendarDays,
  Smartphone,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { VIEW_AS_COOKIE, ROLE_NAV, ACCESS_LEVEL_LABELS, type AccessLevel } from '@/lib/preview-role'

const navItems = [
  { href: '/my-work',    label: 'My Work',     icon: ClipboardList },
  { href: '/projects',   label: 'Projects',   icon: FolderOpen },
  { href: '/quotes',     label: 'Quotes',     icon: FileText   },
  { href: '/clients',    label: 'Clients',    icon: Users      },
  { href: '/staff',      label: 'Staff',         icon: HardHat     },
  { href: '/fieldwork',  label: 'Field Schedule', icon: CalendarDays },
  { href: '/timesheets', label: 'Timesheets',     icon: Clock       },
  { href: '/reports',    label: 'Reports',    icon: BarChart2  },
  { href: '/settings',   label: 'Settings',   icon: Settings   },
  { href: '/field',      label: 'Field App',  icon: Smartphone },
]

interface StaffProfile {
  id: string
  full_name: string
  access_level: AccessLevel
}

interface SidebarProps {
  myProfile: StaffProfile | null
  viewAsProfile: StaffProfile | null
  allStaff: StaffProfile[]
}

export function Sidebar({ myProfile, viewAsProfile, allStaff }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const activeLevel: AccessLevel = (viewAsProfile?.access_level ?? 'admin') as AccessLevel
  const visibleNav = navItems.filter(item => ROLE_NAV[activeLevel].includes(item.href))

  const isAdmin = myProfile?.access_level === 'admin'
  const isViewingAsOther = viewAsProfile?.id !== myProfile?.id

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Clear view-as cookie on sign out
    document.cookie = `${VIEW_AS_COOKIE}=; path=/; max-age=0`
    router.push('/login')
    router.refresh()
  }

  function handleViewAsChange(staffId: string) {
    document.cookie = `${VIEW_AS_COOKIE}=${staffId}; path=/`
    router.refresh()
  }

  return (
    <aside className="fixed top-0 left-0 z-40 flex flex-col w-60 h-screen bg-slate-900 text-slate-100">
      <div className="px-6 py-5 border-b border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">DLCS</p>
        <p className="text-sm font-medium text-white mt-0.5">Project Manager</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {active && <ChevronRight className="h-3 w-3 ml-auto" />}
            </Link>
          )
        })}
      </nav>

      {/* "Viewing as" switcher */}
      {allStaff.length > 0 && (
        <div className="px-3 py-3 border-t border-slate-700">
          <p className="text-xs text-slate-500 uppercase tracking-widest px-1 mb-1.5">Viewing as</p>
          <select
            value={viewAsProfile?.id ?? ''}
            onChange={e => handleViewAsChange(e.target.value)}
            className="w-full rounded-md bg-slate-800 border border-slate-600 text-slate-200 text-sm px-2 py-1.5 cursor-pointer"
          >
            {allStaff.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
          {isViewingAsOther && viewAsProfile && (
            <div className="mt-2 px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-xs text-amber-300 text-center">
              Previewing: {ACCESS_LEVEL_LABELS[viewAsProfile.access_level]}
            </div>
          )}
        </div>
      )}

      <div className="px-3 py-4 border-t border-slate-700">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
