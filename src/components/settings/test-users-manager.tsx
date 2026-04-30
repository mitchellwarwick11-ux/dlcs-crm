'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Copy, Check } from 'lucide-react'

type AccessLevel = 'staff' | 'project_manager' | 'admin'

interface TestUser {
  id: string
  email: string
  full_name: string
  role: string | null
  default_hourly_rate: number | null
  access_level: AccessLevel
  created_at: string
}

interface RoleRate {
  role_key: string
  label: string
  hourly_rate: number
}

const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  staff: 'Staff',
  project_manager: 'Project Manager',
  admin: 'Administrator',
}

const ACCESS_LEVEL_OPTIONS = [
  { value: 'staff' as const,           label: 'Staff — limited access' },
  { value: 'project_manager' as const, label: 'Project Manager — mid-level access' },
  { value: 'admin' as const,           label: 'Administrator — full access' },
]

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const arr = new Uint32Array(12)
  crypto.getRandomValues(arr)
  for (const n of arr) out += chars[n % chars.length]
  return out
}

export function TestUsersManager({
  initialUsers,
  roleRates,
}: {
  initialUsers: TestUser[]
  roleRates: RoleRate[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState(generatePassword())
  const [roleKey, setRoleKey] = useState('')
  const [hourlyRate, setHourlyRate] = useState<number>(0)
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('staff')

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const selectedRole = roleRates.find(r => r.role_key === roleKey)

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const key = e.target.value
    setRoleKey(key)
    const r = roleRates.find(rr => rr.role_key === key)
    if (r) setHourlyRate(r.hourly_rate)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setJustCreated(null)

    if (!roleKey) {
      setCreateError('Please choose a role')
      return
    }

    setCreating(true)

    const res = await fetch('/api/admin/test-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role: roleKey,
        hourly_rate: hourlyRate,
        access_level: accessLevel,
      }),
    })

    setCreating(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setCreateError(data.error ?? 'Failed to create test user')
      return
    }

    setJustCreated({ email: email.trim(), password })
    setEmail('')
    setFullName('')
    setPassword(generatePassword())
    setRoleKey('')
    setHourlyRate(0)
    setAccessLevel('staff')
    startTransition(() => router.refresh())
  }

  async function handleDelete(userId: string, label: string) {
    if (!confirm(`Remove access for ${label}? They will be signed out immediately and won't be able to log in again.`)) {
      return
    }
    setDeletingId(userId)
    setDeleteError(null)

    const res = await fetch(`/api/admin/test-users/${userId}`, { method: 'DELETE' })

    setDeletingId(null)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setDeleteError(data.error ?? 'Failed to delete user')
      return
    }
    startTransition(() => router.refresh())
  }

  async function copyCredentials() {
    if (!justCreated) return
    const text = `Login: https://dlcs-crm.vercel.app/login\nEmail: ${justCreated.email}\nPassword: ${justCreated.password}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function formatRoleLabel(roleKey: string | null) {
    if (!roleKey) return '—'
    const match = roleRates.find(r => r.role_key === roleKey)
    return match?.label ?? roleKey
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Add a test user</h2>
        <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-slate-200 p-4 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="tu-name">Full name</Label>
              <Input
                id="tu-name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Tester"
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tu-email">Email</Label>
              <Input
                id="tu-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tester@example.com"
                required
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="tu-role">Role</Label>
              <select
                id="tu-role"
                value={roleKey}
                onChange={handleRoleChange}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Select role —</option>
                {roleRates.map(r => (
                  <option key={r.role_key} value={r.role_key}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tu-rate">
                Hourly rate
                {selectedRole && (
                  <span className="ml-2 text-xs text-slate-400 font-normal">
                    (default: ${selectedRole.hourly_rate.toFixed(2)}/hr)
                  </span>
                )}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <Input
                  id="tu-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)}
                  className="pl-6"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="tu-access">Access level</Label>
            <select
              id="tu-access"
              value={accessLevel}
              onChange={e => setAccessLevel(e.target.value as AccessLevel)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ACCESS_LEVEL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="tu-password">Password</Label>
            <div className="flex gap-2">
              <Input
                id="tu-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="off"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(generatePassword())}
              >
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Auto-generated. You can edit it, but make sure to copy it before creating —
              it can&apos;t be shown again afterwards.
            </p>
          </div>

          {createError && <p className="text-sm text-red-600">{createError}</p>}

          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create test user'}
          </Button>
        </form>

        {justCreated && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm text-green-900 space-y-1">
                <div className="font-medium">User created. Share these details with the tester:</div>
                <div className="font-mono text-xs space-y-0.5 mt-2">
                  <div>URL: https://dlcs-crm.vercel.app/login</div>
                  <div>Email: {justCreated.email}</div>
                  <div>Password: {justCreated.password}</div>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={copyCredentials}>
                {copied ? <><Check className="h-3.5 w-3.5 mr-1" /> Copied</> : <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Existing test users ({initialUsers.length})
        </h2>

        {deleteError && <p className="text-sm text-red-600 mb-3">{deleteError}</p>}

        {initialUsers.length === 0 ? (
          <p className="text-sm text-slate-500">No test users yet.</p>
        ) : (
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="text-left font-medium text-slate-500 px-4 py-2">Name</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2">Email</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2">Role</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2">Access</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {initialUsers.map(u => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{u.full_name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatRoleLabel(u.role)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{ACCESS_LEVEL_LABELS[u.access_level]}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={deletingId === u.id}
                      onClick={() => handleDelete(u.id, u.full_name || u.email)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {deletingId === u.id ? 'Removing…' : 'Remove'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
