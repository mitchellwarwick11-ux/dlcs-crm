import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Plus, UserX } from 'lucide-react'

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>
}) {
  const { inactive } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any
  const showInactive = inactive === '1'

  const [{ data: staff }, { data: roleRates }] = await Promise.all([
    db.from('staff_profiles')
      .select('id, full_name, email, role, default_hourly_rate, is_active')
      .eq('is_active', showInactive ? false : true)
      .order('full_name'),
    db.from('role_rates').select('role_key, label, sort_order').order('sort_order'),
  ])

  // Build role lookup map
  type RoleInfo = { label: string; sort_order: number }
  const roleMap: Record<string, RoleInfo> = {}
  for (const r of (roleRates ?? [])) {
    roleMap[r.role_key] = { label: r.label, sort_order: r.sort_order }
  }

  // Group staff by role, preserving role sort_order
  const grouped: Record<string, { roleLabel: string; sortOrder: number; members: any[] }> = {}
  for (const s of (staff ?? [])) {
    const role = s.role ?? 'unknown'
    if (!grouped[role]) {
      grouped[role] = {
        roleLabel: roleMap[role]?.label ?? role,
        sortOrder: roleMap[role]?.sort_order ?? 999,
        members: [],
      }
    }
    grouped[role].members.push(s)
  }

  const sortedGroups = Object.entries(grouped).sort((a, b) => a[1].sortOrder - b[1].sortOrder)
  const totalCount = staff?.length ?? 0

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Staff</h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalCount} {showInactive ? 'inactive' : 'active'} staff member{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/staff/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Staff
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Link
          href={showInactive ? '/staff' : '/staff?inactive=1'}
          className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
        >
          {showInactive ? 'Show active staff' : 'Show inactive staff'}
        </Link>
      </div>

      {totalCount === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-sm">{showInactive ? 'No inactive staff.' : 'No staff yet.'}</p>
          {!showInactive && (
            <Link href="/staff/new">
              <Button variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add your first staff member
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {sortedGroups.map(([roleKey, group]) => (
            <div key={roleKey}>
              {/* Role heading */}
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {group.roleLabel}
                </h2>
                <span className="text-xs text-slate-400">
                  {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Members in this role */}
              <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                {group.members.map((s: any) => (
                  <Link
                    key={s.id}
                    href={`/staff/${s.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-slate-600">
                        {s.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{s.full_name}</p>
                      <p className="text-xs text-slate-400">{s.email}</p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-3">
                      <p className="text-sm text-slate-600">
                        ${Number(s.default_hourly_rate).toFixed(2)}
                        <span className="text-xs text-slate-400">/hr</span>
                      </p>
                      {!s.is_active && <UserX className="h-4 w-4 text-slate-400" />}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
