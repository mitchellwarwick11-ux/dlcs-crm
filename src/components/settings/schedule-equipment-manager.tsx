'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ScheduleEquipmentRow } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Pencil, Check, X, Trash2 } from 'lucide-react'

interface Props {
  initialEquipment: ScheduleEquipmentRow[]
}

export function ScheduleEquipmentManager({ initialEquipment }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<ScheduleEquipmentRow[]>(initialEquipment)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const db = createClient() as any

  function startEdit(item: ScheduleEquipmentRow) {
    setEditingId(item.id)
    setEditLabel(item.label)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditLabel('')
  }

  async function saveEdit(item: ScheduleEquipmentRow) {
    if (!editLabel.trim()) return
    setSaving(true)
    const { error } = await db
      .from('schedule_equipment')
      .update({ label: editLabel.trim() })
      .eq('id', item.id)
    if (!error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, label: editLabel.trim() } : i))
      cancelEdit()
    }
    setSaving(false)
  }

  async function toggleActive(item: ScheduleEquipmentRow) {
    const { error } = await db
      .from('schedule_equipment')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
    if (!error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
    }
  }

  async function addItem() {
    if (!newLabel.trim()) { setAddError('Equipment name is required.'); return }
    if (items.some(i => i.label.toLowerCase() === newLabel.trim().toLowerCase())) {
      setAddError('An item with that name already exists.')
      return
    }
    setAdding(true)
    setAddError(null)
    const { data, error } = await db
      .from('schedule_equipment')
      .insert({ label: newLabel.trim(), sort_order: items.length + 1, is_active: true })
      .select()
      .single()
    if (error || !data) {
      setAddError('Failed to add equipment. Please try again.')
    } else {
      setItems(prev => [...prev, data])
      setNewLabel('')
      setShowAddForm(false)
    }
    setAdding(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Field Schedule Equipment</CardTitle>
        <p className="text-sm text-muted-foreground">
          Equipment and resources available when creating fieldwork bookings.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">

        {items.map(item => (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${item.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}
          >
            {editingId === item.id ? (
              <>
                <div className="flex-1">
                  <Label className="text-xs mb-1 block">Equipment Name</Label>
                  <Input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); if (e.key === 'Escape') cancelEdit() }}
                  />
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon-sm" onClick={() => saveEdit(item)} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon-sm" variant="outline" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className={`flex-1 text-sm font-medium ${item.is_active ? 'text-slate-900' : 'text-slate-400'}`}>
                  {item.label}
                </p>
                {!item.is_active && (
                  <span className="text-xs text-slate-400 italic">Inactive</span>
                )}
                <div className="flex gap-1 shrink-0">
                  <Button size="icon-sm" variant="outline" onClick={() => startEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={() => toggleActive(item)}
                    title={item.is_active ? 'Deactivate' : 'Reactivate'}
                  >
                    <Trash2 className={`h-3.5 w-3.5 ${item.is_active ? 'text-slate-400' : 'text-green-600'}`} />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}

        {showAddForm ? (
          <div className="border-2 border-dashed border-slate-300 rounded-lg px-4 py-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">New Equipment</p>
            <div>
              <Label className="text-xs mb-1 block">Name</Label>
              <Input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. Robotic Total Station"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') addItem() }}
              />
            </div>
            {addError && <p className="text-xs text-red-500">{addError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={addItem} disabled={adding}>
                {adding && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setAddError(null); setNewLabel('') }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Equipment
          </Button>
        )}

        <p className="text-xs text-slate-400 pt-2">
          Deactivating an item hides it from new bookings but keeps existing schedule entries intact.
        </p>
      </CardContent>
    </Card>
  )
}
