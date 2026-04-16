'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, X } from 'lucide-react'
import type { ActiveProject, MyTask } from './my-work-board'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: ActiveProject[]
  staffId: string
  onTaskAdded: (task: MyTask) => void
}

export function QuickAddTaskForm({ open, onOpenChange, projects, staffId, onTaskAdded }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [projectId, setProjectId] = useState('')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')

  function resetForm() {
    setProjectId('')
    setTitle('')
    setDueDate('')
    setDescription('')
    setError(null)
  }

  function handleClose() {
    onOpenChange(false)
    resetForm()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !title.trim()) return

    setSaving(true)
    setError(null)

    const db = createClient() as any

    // 1. Create the task
    const { data: newTask, error: taskError } = await db
      .from('project_tasks')
      .insert({
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        fee_type: 'hourly',
        status: 'not_started',
        sort_order: 0,
      })
      .select('id')
      .single()

    if (taskError || !newTask) {
      setError(taskError?.message ?? 'Failed to create task')
      setSaving(false)
      return
    }

    // 2. Assign to current user
    await db.from('task_assignments').insert({
      task_id: newTask.id,
      staff_id: staffId,
    })

    // Build the MyTask object for optimistic update
    const proj = projects.find(p => p.id === projectId)
    onTaskAdded({
      taskId: newTask.id,
      title: title.trim(),
      description: description.trim() || null,
      status: 'not_started',
      feeType: 'hourly',
      dueDate: dueDate || null,
      projectId,
      jobNumber: proj?.jobNumber ?? '',
      projectTitle: proj?.title ?? '',
      projectStatus: 'active',
      clientName: proj?.clientName ?? null,
      totalHoursLogged: 0,
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

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Quick Add Task</h2>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Project */}
          <div className="space-y-1.5">
            <Label>Job <span className="text-red-500">*</span></Label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              required
            >
              <option value="">— Select a job —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.jobNumber} — {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Task Title <span className="text-red-500">*</span></Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Email client, Call council, Review plans"
              required
            />
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional details…"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !projectId || !title.trim()}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Task
          </Button>
        </div>
      </div>
    </>
  )
}
