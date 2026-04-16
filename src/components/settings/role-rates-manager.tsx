'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RoleRate } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Pencil, Check, X, Trash2 } from 'lucide-react'

interface RoleRatesManagerProps {
  initialRoleRates: RoleRate[]
}

export function RoleRatesManager({ initialRoleRates }: RoleRatesManagerProps) {
  const router = useRouter()
  const [roles, setRoles] = useState<RoleRate[]>(initialRoleRates)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editRate, setEditRate] = useState('')
  const [saving, setSaving] = useState(false)

  // New role form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newRate, setNewRate] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const db = createClient() as any

  function startEdit(role: RoleRate) {
    setEditingId(role.id)
    setEditLabel(role.label)
    setEditRate(String(role.hourly_rate))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditLabel('')
    setEditRate('')
  }

  async function saveEdit(role: RoleRate) {
    const rate = parseFloat(editRate)
    if (isNaN(rate) || rate < 0) return
    setSaving(true)

    const { error } = await db.from('role_rates').update({
      label: editLabel.trim(),
      hourly_rate: rate,
    }).eq('id', role.id)

    if (!error) {
      setRoles(prev => prev.map(r => r.id === role.id
        ? { ...r, label: editLabel.trim(), hourly_rate: rate }
        : r
      ))
      cancelEdit()
    }
    setSaving(false)
  }

  async function toggleActive(role: RoleRate) {
    const { error } = await db.from('role_rates').update({ is_active: !role.is_active }).eq('id', role.id)
    if (!error) {
      setRoles(prev => prev.map(r => r.id === role.id ? { ...r, is_active: !r.is_active } : r))
    }
  }

  async function addRole() {
    if (!newLabel.trim() || !newRate.trim()) { setAddError('Both fields are required.'); return }
    const rate = parseFloat(newRate)
    if (isNaN(rate) || rate < 0) { setAddError('Enter a valid hourly rate.'); return }

    // Generate a key from the label
    const role_key = newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (roles.some(r => r.role_key === role_key)) { setAddError('A role with that name already exists.'); return }

    setAdding(true)
    setAddError(null)

    const { data, error } = await db.from('role_rates').insert({
      role_key,
      label: newLabel.trim(),
      hourly_rate: rate,
      sort_order: roles.length + 1,
      is_active: true,
    }).select().single()

    if (error || !data) {
      setAddError('Failed to add role. Please try again.')
    } else {
      setRoles(prev => [...prev, data])
      setNewLabel('')
      setNewRate('')
      setShowAddForm(false)
    }
    setAdding(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Hourly Rates</CardTitle>
        <p className="text-sm text-muted-foreground">
          These rates are the default for each role. Individual staff rates can be overridden on their profile.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">

        {/* Role list */}
        {roles.map(role => (
          <div
            key={role.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${role.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}
          >
            {editingId === role.id ? (
              // Edit mode
              <>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">Role Name</Label>
                    <Input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Hourly Rate</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <Input
                        value={editRate}
                        onChange={e => setEditRate(e.target.value)}
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-sm pl-6"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon-sm" onClick={() => saveEdit(role)} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon-sm" variant="outline" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              // Display mode
              <>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${role.is_active ? 'text-slate-900' : 'text-slate-400'}`}>
                    {role.label}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">{role.role_key}</p>
                </div>
                <p className={`text-sm font-medium shrink-0 ${role.is_active ? 'text-slate-700' : 'text-slate-400'}`}>
                  ${Number(role.hourly_rate).toFixed(2)}/hr
                </p>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon-sm" variant="outline" onClick={() => startEdit(role)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={() => toggleActive(role)}
                    title={role.is_active ? 'Deactivate role' : 'Reactivate role'}
                  >
                    <Trash2 className={`h-3.5 w-3.5 ${role.is_active ? 'text-slate-400' : 'text-green-600'}`} />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Add new role */}
        {showAddForm ? (
          <div className="border-2 border-dashed border-slate-300 rounded-lg px-4 py-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">New Role</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Role Name</Label>
                <Input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="e.g. Senior Drafter"
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Hourly Rate</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <Input
                    value={newRate}
                    onChange={e => setNewRate(e.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="h-8 text-sm pl-6"
                  />
                </div>
              </div>
            </div>
            {addError && <p className="text-xs text-red-500">{addError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={addRole} disabled={adding}>
                {adding && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Add Role
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setAddError(null); setNewLabel(''); setNewRate('') }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        )}

        <p className="text-xs text-slate-400 pt-2">
          Deactivating a role hides it from the role picker but keeps existing staff assignments intact.
        </p>
      </CardContent>
    </Card>
  )
}
