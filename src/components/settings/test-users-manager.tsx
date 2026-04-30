'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Copy, Check } from 'lucide-react'

interface TestUser {
  id: string
  email: string
  full_name: string
  created_at: string
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const arr = new Uint32Array(12)
  crypto.getRandomValues(arr)
  for (const n of arr) out += chars[n % chars.length]
  return out
}

export function TestUsersManager({ initialUsers }: { initialUsers: TestUser[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState(generatePassword())
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setJustCreated(null)
    setCreating(true)

    const res = await fetch('/api/admin/test-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, full_name: fullName.trim() }),
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

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Add a test user</h2>
        <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-slate-200 p-4 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="space-y-1">
              <Label htmlFor="tu-name">Display name</Label>
              <Input
                id="tu-name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Tester"
                autoComplete="off"
              />
            </div>
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
                <th className="text-left font-medium text-slate-500 px-4 py-2">Created</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {initialUsers.map(u => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{u.full_name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(u.created_at).toLocaleDateString('en-AU', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
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
