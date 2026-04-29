'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, X } from 'lucide-react'
import { TASK_STATUSES } from '@/lib/constants/statuses'
import type { TaskStatus } from '@/lib/constants/statuses'
import type { MyItem } from './my-work-board'

interface Props {
  item: MyItem | null
  onClose: () => void
  onSaved: (updated: Partial<MyItem> & { itemId: string }) => void
}

export function EditItemForm({ item, onClose, onSaved }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<TaskStatus>('not_started')

  useEffect(() => {
    if (!item) return
    setTitle(item.title ?? '')
    setDescription(item.description ?? '')
    setNotes(item.notes ?? '')
    setDueDate(item.dueDate ?? '')
    setStatus(item.status as TaskStatus)
    setError(null)
  }, [item])

  if (!item) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!item || !title.trim()) return

    setSaving(true)
    setError(null)

    const db = createClient() as any
    const patch = {
      title: title.trim(),
      description: description.trim() || null,
      notes: notes.trim() || null,
      due_date: dueDate || null,
      status,
    }

    const { error: updateError } = await db
      .from('task_items')
      .update(patch)
      .eq('id', item.itemId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    onSaved({
      itemId: item.itemId,
      title: patch.title,
      description: patch.description,
      notes: patch.notes,
      dueDate: patch.due_date,
      status: patch.status,
    })

    setSaving(false)
    onClose()
    router.refresh()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">Edit Item</h2>
            <p className="text-xs text-slate-500 truncate">
              {item.jobNumber} · {item.taskTitle}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as TaskStatus)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {Object.entries(TASK_STATUSES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            {dueDate && (
              <button
                type="button"
                onClick={() => setDueDate('')}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Clear due date
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short summary (optional)"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Longer notes, context, links, etc. (optional)"
              rows={8}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-y"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </>
  )
}
