'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Pencil, Trash2, X, GripVertical } from 'lucide-react'

interface ChecklistItem {
  id: string
  text: string
}

interface ChecklistTemplate {
  id: string
  title: string
  items: ChecklistItem[]
  task_definition_id: string | null
  is_active: boolean
  sort_order: number
}

interface TaskDef {
  id: string
  name: string
  applicable_job_type: string | null
  is_active: boolean
}

interface Props {
  initialTemplates: ChecklistTemplate[]
  taskDefinitions: TaskDef[]
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `tmp-${Math.random().toString(36).slice(2)}`
}

export function ChecklistTemplatesManager({ initialTemplates, taskDefinitions }: Props) {
  const router = useRouter()
  const [templates, setTemplates] = useState<ChecklistTemplate[]>(initialTemplates)
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const db = createClient() as any

  const taskDefById = useMemo(() => {
    const m = new Map<string, TaskDef>()
    for (const td of taskDefinitions) m.set(td.id, td)
    return m
  }, [taskDefinitions])

  function startNew() {
    setEditing({
      id: '',
      title: '',
      items: [],
      task_definition_id: null,
      is_active: true,
      sort_order: templates.length + 1,
    })
    setShowForm(true)
  }

  function startEdit(t: ChecklistTemplate) {
    setEditing({ ...t, items: [...t.items] })
    setShowForm(true)
  }

  function closeForm() {
    setEditing(null)
    setShowForm(false)
  }

  async function handleSaved(saved: ChecklistTemplate) {
    setTemplates(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      if (idx === -1) return [...prev, saved]
      const next = [...prev]
      next[idx] = saved
      return next
    })
    closeForm()
    router.refresh()
  }

  async function handleDelete(t: ChecklistTemplate) {
    if (!confirm(`Delete "${t.title}"? This cannot be undone.`)) return
    const { error } = await db.from('checklist_templates').delete().eq('id', t.id)
    if (!error) {
      setTemplates(prev => prev.filter(p => p.id !== t.id))
      router.refresh()
    } else {
      alert('Failed to delete: ' + error.message)
    }
  }

  async function toggleActive(t: ChecklistTemplate) {
    const { error } = await db
      .from('checklist_templates')
      .update({ is_active: !t.is_active })
      .eq('id', t.id)
    if (!error) {
      setTemplates(prev => prev.map(p => p.id === t.id ? { ...p, is_active: !p.is_active } : p))
    }
  }

  // Task types that already have a template (used to filter the dropdown)
  const usedTaskIds = new Set(
    templates
      .filter(t => t.id !== editing?.id && t.task_definition_id)
      .map(t => t.task_definition_id as string)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {templates.length === 0 && !showForm && (
          <p className="text-sm text-slate-500 italic px-1 py-4">
            No checklist templates yet. Create one to get started.
          </p>
        )}

        {templates.map(t => {
          const taskDef = t.task_definition_id ? taskDefById.get(t.task_definition_id) : null
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${t.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${t.is_active ? 'text-slate-900' : 'text-slate-400'}`}>
                    {t.title}
                  </p>
                  {!t.is_active && <span className="text-xs text-slate-400 italic">Inactive</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span>
                    Task type: <span className="font-medium text-slate-700">{taskDef?.name ?? '— none —'}</span>
                  </span>
                  <span>•</span>
                  <span>{t.items.length} item{t.items.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon-sm" variant="outline" onClick={() => startEdit(t)} title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => toggleActive(t)}
                  title={t.is_active ? 'Deactivate' : 'Reactivate'}
                >
                  <span className={`text-xs font-bold ${t.is_active ? 'text-slate-400' : 'text-green-600'}`}>
                    {t.is_active ? 'OFF' : 'ON'}
                  </span>
                </Button>
                <Button size="icon-sm" variant="outline" onClick={() => handleDelete(t)} title="Delete">
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
          )
        })}

        {showForm && editing ? (
          <TemplateForm
            template={editing}
            taskDefinitions={taskDefinitions}
            usedTaskIds={usedTaskIds}
            onCancel={closeForm}
            onSaved={handleSaved}
          />
        ) : (
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={startNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Checklist Template
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function TemplateForm({
  template,
  taskDefinitions,
  usedTaskIds,
  onCancel,
  onSaved,
}: {
  template: ChecklistTemplate
  taskDefinitions: TaskDef[]
  usedTaskIds: Set<string>
  onCancel: () => void
  onSaved: (t: ChecklistTemplate) => void
}) {
  const [title, setTitle] = useState(template.title)
  const [taskId, setTaskId] = useState<string | null>(template.task_definition_id)
  const [isActive, setIsActive] = useState(template.is_active)
  const [items, setItems] = useState<ChecklistItem[]>(
    template.items.length > 0 ? template.items : [{ id: makeId(), text: '' }]
  )
  const [newItemText, setNewItemText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const db = createClient() as any
  const isNew = template.id === ''

  // If user picks a task type and title is empty, auto-fill the title.
  function selectTaskType(id: string | null) {
    setTaskId(id)
    if (id && !title.trim()) {
      const td = taskDefinitions.find(t => t.id === id)
      if (td) setTitle(td.name)
    }
  }

  function addItem() {
    const text = newItemText.trim()
    if (!text) return
    setItems(prev => [...prev, { id: makeId(), text }])
    setNewItemText('')
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function updateItemText(id: string, text: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, text } : i))
  }

  function moveItem(id: string, dir: -1 | 1) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === id)
      if (idx === -1) return prev
      const targetIdx = idx + dir
      if (targetIdx < 0 || targetIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
      return next
    })
  }

  async function save() {
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    const cleanItems = items.map(i => ({ id: i.id, text: i.text.trim() })).filter(i => i.text)
    if (cleanItems.length === 0) { setError('Add at least one checklist item.'); return }

    setSaving(true)
    const payload = {
      title: title.trim(),
      task_definition_id: taskId,
      is_active: isActive,
      items: cleanItems,
      sort_order: template.sort_order,
    }

    if (isNew) {
      const { data, error: err } = await db
        .from('checklist_templates')
        .insert(payload)
        .select('id, title, items, task_definition_id, is_active, sort_order')
        .single()
      if (err || !data) {
        setError(err?.message?.includes('uniq_checklist_templates_task_definition')
          ? 'A template already exists for this task type.'
          : (err?.message ?? 'Failed to save.'))
        setSaving(false)
        return
      }
      onSaved(data as ChecklistTemplate)
    } else {
      const { data, error: err } = await db
        .from('checklist_templates')
        .update(payload)
        .eq('id', template.id)
        .select('id, title, items, task_definition_id, is_active, sort_order')
        .single()
      if (err || !data) {
        setError(err?.message?.includes('uniq_checklist_templates_task_definition')
          ? 'A template already exists for this task type.'
          : (err?.message ?? 'Failed to save.'))
        setSaving(false)
        return
      }
      onSaved(data as ChecklistTemplate)
    }
    setSaving(false)
  }

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 space-y-4">
      <p className="text-sm font-medium text-slate-700">
        {isNew ? 'New Checklist Template' : 'Edit Checklist Template'}
      </p>

      <div>
        <Label className="text-xs mb-1 block">Task Type</Label>
        <select
          value={taskId ?? ''}
          onChange={e => selectTaskType(e.target.value || null)}
          className="w-full h-9 px-2 text-sm border border-slate-300 rounded-md bg-white"
        >
          <option value="">— Select a task type —</option>
          {taskDefinitions.map(td => {
            const used = usedTaskIds.has(td.id)
            return (
              <option key={td.id} value={td.id} disabled={used}>
                {td.name}{used ? ' (already has a template)' : ''}
              </option>
            )
          })}
        </select>
        <p className="text-[11px] text-slate-400 mt-1">
          The checklist will appear when a task of this type is scheduled.
        </p>
      </div>

      <div>
        <Label className="text-xs mb-1 block">Title</Label>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Set-out Survey"
          className="h-9 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs mb-2 block">Checklist Items</Label>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => moveItem(item.id, -1)}
                disabled={idx === 0}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-1"
                title="Move up"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <Input
                value={item.text}
                onChange={e => updateItemText(item.id, e.target.value)}
                placeholder={`Item ${idx + 1}`}
                className="h-8 text-sm flex-1"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => removeItem(item.id)}
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newItemText}
              onChange={e => setNewItemText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
              placeholder="Type item and press Enter"
              className="h-8 text-sm flex-1"
            />
            <Button type="button" size="sm" variant="outline" onClick={addItem}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isActive}
          onChange={e => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Active (visible to surveyors in the field app)
      </label>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {isNew ? 'Create Template' : 'Save Changes'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
