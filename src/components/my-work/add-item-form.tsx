'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, X, Plus } from 'lucide-react'
import type { ActiveProject, ActiveTask, MyItem } from './my-work-board'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: ActiveProject[]
  tasks: ActiveTask[]
  staffId: string
  onItemAdded: (item: MyItem) => void
}

export function AddItemForm({
  open,
  onOpenChange,
  projects,
  tasks,
  staffId,
  onItemAdded,
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [projectId, setProjectId] = useState('')
  const [taskMode, setTaskMode] = useState<'select' | 'create'>('select')
  const [taskId, setTaskId] = useState('')

  // New task fields (only used if taskMode === 'create')
  const [newTaskTitle, setNewTaskTitle] = useState('')

  // Item fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  const availableTasks = projectId
    ? tasks.filter(t => t.projectId === projectId)
    : []

  const taskSelected = taskMode === 'select' ? !!taskId : !!newTaskTitle.trim()

  function resetForm() {
    setProjectId('')
    setTaskMode('select')
    setTaskId('')
    setNewTaskTitle('')
    setTitle('')
    setDescription('')
    setDueDate('')
    setError(null)
  }

  function handleClose() {
    onOpenChange(false)
    resetForm()
  }

  function handleProjectChange(id: string) {
    setProjectId(id)
    setTaskId('')
    setTaskMode('select')
    setNewTaskTitle('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !taskSelected || !title.trim()) return

    setSaving(true)
    setError(null)

    const db = createClient() as any

    let resolvedTaskId = taskId
    let resolvedTaskTitle = availableTasks.find(t => t.id === taskId)?.title ?? ''
    let resolvedFeeType = availableTasks.find(t => t.id === taskId)?.feeType ?? 'hourly'

    // If creating a new task, insert it + assignment first
    if (taskMode === 'create') {
      const { data: newTask, error: taskError } = await db
        .from('project_tasks')
        .insert({
          project_id: projectId,
          title: newTaskTitle.trim(),
          fee_type: 'hourly',
          status: 'not_started',
          sort_order: 0,
        })
        .select('id, title, fee_type')
        .single()

      if (taskError || !newTask) {
        setError(taskError?.message ?? 'Failed to create task')
        setSaving(false)
        return
      }

      resolvedTaskId = newTask.id
      resolvedTaskTitle = newTask.title
      resolvedFeeType = newTask.fee_type

      // Assign current user to the new task as well
      await db.from('task_assignments').insert({
        task_id: newTask.id,
        staff_id: staffId,
      })
    }

    // Insert the item
    const { data: newItem, error: itemError } = await db
      .from('task_items')
      .insert({
        task_id: resolvedTaskId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        status: 'not_started',
        sort_order: 0,
        created_by: staffId,
      })
      .select('id')
      .single()

    if (itemError || !newItem) {
      setError(itemError?.message ?? 'Failed to create item')
      setSaving(false)
      return
    }

    // Assign the item to the current user
    const { error: assignError } = await db
      .from('task_item_assignments')
      .insert({ item_id: newItem.id, staff_id: staffId })

    if (assignError) {
      setError(assignError.message)
      setSaving(false)
      return
    }

    // Build optimistic MyItem
    const proj = projects.find(p => p.id === projectId)
    onItemAdded({
      itemId: newItem.id,
      title: title.trim(),
      description: description.trim() || null,
      status: 'not_started',
      dueDate: dueDate || null,
      sortOrder: 0,
      taskId: resolvedTaskId,
      taskTitle: resolvedTaskTitle,
      taskStatus: 'not_started',
      taskFeeType: resolvedFeeType,
      projectId,
      jobNumber: proj?.jobNumber ?? '',
      projectTitle: proj?.title ?? '',
      projectStatus: 'active',
      clientName: proj?.clientName ?? null,
      taskHoursLogged: 0,
    })

    setSaving(false)
    handleClose()
    router.refresh()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={handleClose} />

      {/* Slide-over */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Add Item</h2>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Step 1: Job */}
          <div className="space-y-1.5">
            <Label>Job <span className="text-red-500">*</span></Label>
            <select
              value={projectId}
              onChange={e => handleProjectChange(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">— Select a job —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.jobNumber} — {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Task */}
          {projectId && (
            <div className="space-y-1.5">
              <Label>Task <span className="text-red-500">*</span></Label>
              {taskMode === 'select' ? (
                <>
                  <select
                    value={taskId}
                    onChange={e => setTaskId(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    disabled={availableTasks.length === 0}
                  >
                    <option value="">
                      {availableTasks.length === 0
                        ? '— No existing tasks —'
                        : '— Select a task —'}
                    </option>
                    {availableTasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setTaskMode('create'); setTaskId('') }}
                    className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Create a new task instead
                  </button>
                </>
              ) : (
                <>
                  <Input
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    placeholder="e.g. Contour & Detail Survey"
                    autoFocus
                  />
                  {availableTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setTaskMode('select'); setNewTaskTitle('') }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      ← Back to existing tasks
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3: Item details */}
          {projectId && taskSelected && (
            <>
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label>Item Title <span className="text-red-500">*</span></Label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Order titles, Call council, Reduce fieldwork"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Optional details…"
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !projectId || !taskSelected || !title.trim()}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Item
          </Button>
        </div>
      </div>
    </>
  )
}
