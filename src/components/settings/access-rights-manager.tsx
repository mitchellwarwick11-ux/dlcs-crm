'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react'

const LEVELS = [
  {
    value: 'staff',
    label: 'Staff',
    description: 'Field surveyors, office surveyors, drafters — limited financial access',
    icon: Shield,
    colour: 'text-slate-400',
    badge: 'bg-slate-100 text-slate-600',
  },
  {
    value: 'project_manager',
    label: 'Project Manager',
    description: 'Can manage jobs, tasks, and clients — limited financial access',
    icon: ShieldCheck,
    colour: 'text-blue-500',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Full access including financial pages, settings, and reports',
    icon: ShieldAlert,
    colour: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-700',
  },
] as const

type AccessLevel = 'staff' | 'project_manager' | 'admin'

interface StaffRow {
  id: string
  full_name: string
  role: string
  is_active: boolean
  access_level: AccessLevel
}

export function AccessRightsManager({ staffList }: { staffList: StaffRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(staffId: string, newLevel: AccessLevel) {
    setUpdating(staffId)
    setError(null)
    const db = createClient() as any
    const { error: err } = await db
      .from('staff_profiles')
      .update({ access_level: newLevel })
      .eq('id', staffId)
    setUpdating(null)
    if (err) {
      setError(`Failed to update access level: ${err.message}`)
      return
    }
    startTransition(() => router.refresh())
  }

  const active   = staffList.filter(s => s.is_active)
  const inactive = staffList.filter(s => !s.is_active)

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm">
        <div className="font-medium text-slate-700 mb-2">Access level summary</div>
        <div className="flex gap-6">
          {LEVELS.map(l => {
            const count = staffList.filter(s => s.access_level === l.value).length
            const Icon = l.icon
            return (
              <div key={l.value} className="flex items-center gap-1.5">
                <Icon className={`h-4 w-4 ${l.colour}`} />
                <span className="text-slate-600">{l.label}:</span>
                <span className="font-semibold text-slate-900">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left font-medium text-slate-500 pb-2 pr-4">Name</th>
            <th className="text-left font-medium text-slate-500 pb-2 pr-4">Role</th>
            <th className="text-left font-medium text-slate-500 pb-2">Access Level</th>
          </tr>
        </thead>
        <tbody>
          {active.map(s => {
            const currentLevel = LEVELS.find(l => l.value === s.access_level) ?? LEVELS[0]
            const Icon = currentLevel.icon
            return (
              <tr key={s.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-4 font-medium text-slate-900">{s.full_name}</td>
                <td className="py-2.5 pr-4 text-slate-500 capitalize">{s.role?.replace(/_/g, ' ')}</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 flex-shrink-0 ${currentLevel.colour}`} />
                    <select
                      value={s.access_level}
                      disabled={updating === s.id}
                      onChange={e => handleChange(s.id, e.target.value as AccessLevel)}
                      className="rounded border border-input bg-background px-2 py-1 text-sm disabled:opacity-50"
                    >
                      {LEVELS.map(l => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                    {updating === s.id && (
                      <span className="text-xs text-slate-400">Saving…</span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
          {inactive.length > 0 && (
            <>
              <tr>
                <td colSpan={3} className="pt-4 pb-1 text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Inactive staff
                </td>
              </tr>
              {inactive.map(s => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 opacity-50">
                  <td className="py-2 pr-4 text-slate-500">{s.full_name}</td>
                  <td className="py-2 pr-4 text-slate-400 capitalize">{s.role?.replace(/_/g, ' ')}</td>
                  <td className="py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${LEVELS.find(l => l.value === s.access_level)?.badge ?? ''}`}>
                      {LEVELS.find(l => l.value === s.access_level)?.label}
                    </span>
                  </td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>

      <div className="mt-6 space-y-2">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Level descriptions</div>
        {LEVELS.map(l => {
          const Icon = l.icon
          return (
            <div key={l.value} className="flex items-start gap-2 text-sm">
              <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${l.colour}`} />
              <div>
                <span className="font-medium text-slate-700">{l.label}: </span>
                <span className="text-slate-500">{l.description}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
