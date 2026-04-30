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
    <aside className="fixed top-0 left-0 z-40 flex flex-col w-60 h-screen bg-dlcs-sidebar-bg text-dlcs-nav-text">
      {/* Brand header: orange stripe + DLCS eyebrow + Project Manager */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
        <span aria-hidden className="block w-1 h-9 rounded-sm bg-dlcs-brand" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold tracking-[0.12em] text-dlcs-ink-faint">DLCS</span>
          <span className="text-[15px] font-bold text-white leading-tight">Project Manager</span>
        </div>
      </div>

      <nav className="flex-1 px-3 pt-3 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-dlcs-sidebar-active text-white font-semibold'
                  : 'text-dlcs-nav-text font-medium hover:bg-dlcs-sidebar-active/60 hover:text-white'
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0 transition-colors',
                  active ? 'text-dlcs-brand' : 'text-dlcs-nav-icon group-hover:text-white'
                )}
              />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-4 w-4 text-dlcs-ink-faint" />}
            </Link>
          )
        })}
      </nav>

      {/* "Viewing as" switcher */}
      {allStaff.length > 0 && (
        <div className="px-3 py-3 border-t border-dlcs-sidebar-border">
          <p className="text-[11px] text-dlcs-ink-faint uppercase tracking-[0.12em] px-1 mb-1.5">Viewing as</p>
          <select
            value={viewAsProfile?.id ?? ''}
            onChange={e => handleViewAsChange(e.target.value)}
            className="w-full rounded-md bg-dlcs-sidebar-active border border-dlcs-sidebar-border text-dlcs-nav-text text-sm px-2 py-1.5 cursor-pointer"
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

      <div className="px-3 py-4 border-t border-dlcs-sidebar-border">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-dlcs-nav-text hover:text-white hover:bg-dlcs-sidebar-active/60 transition-colors"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0 text-dlcs-nav-icon" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
