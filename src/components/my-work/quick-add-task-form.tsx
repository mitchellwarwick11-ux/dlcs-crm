'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TASK_STATUSES } from '@/lib/constants/statuses'
import type { TaskStatus } from '@/lib/constants/statuses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, X, Plus, CheckCircle2 } from 'lucide-react'
import type { ActiveProject, MyTask, ExistingTask } from './my-work-board'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: ActiveProject[]
  allProjectTasks: ExistingTask[]
  myTaskIds: string[]
  staffId: string
  onTaskAdded: (task: MyTask) => void
}

export function QuickAddTaskForm({
  open,
  onOpenChange,
  projects,
  allProjectTasks,
  myTaskIds,
  staffId,
  onTaskAdded,
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [projectId, setProjectId] = useState('')
  const [mode, setMode] = useState<'select' | 'create'>('select')

  // Create mode fields
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')

  // Tasks for selected project, excluding ones already on My Work
  const availableTasks = projectId
    ? allProjectTasks.filter(t => t.projectId === projectId && !myTaskIds.includes(t.id))
    : []

  function resetForm() {
    setProjectId('')
    setMode('select')
    setTitle('')
    setDueDate('')
    setDescription('')
    setError(null)
  }

  function handleClose() {
    onOpenChange(false)
    resetForm()
  }

  function handleProjectChange(id: string) {
    setProjectId(id)
    setMode('select')
  }

  // Add existing task to My Work (create task_assignment)
  async function handleSelectExisting(task: ExistingTask) {
    setSaving(true)
    setError(null)

    const db = createClient() as any
    const { error: assignError } = await db
      .from('task_assignments')
      .insert({ task_id: task.id, staff_id: staffId })

    if (assignError) {
      setError(assignError.message)
      setSaving(false)
      return
    }

    const proj = projects.find(p => p.id === projectId)
    onTaskAdded({
      taskId: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      feeType: task.feeType,
      dueDate: task.dueDate,
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

  // Create new task + assign
  async function handleCreateNew(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !title.trim()) return

    setSaving(true)
    setError(null)

    const db = createClient() as any

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

    await db.from('task_assignments').insert({
      task_id: newTask.id,
      staff_id: staffId,
    })

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
          <h2 className="text-lg font-semibold text-slate-900">Add Task to My Work</h2>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Step 1: Select Job */}
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

          {/* Step 2: Show existing tasks or create new */}
          {projectId && (
            <>
              {/* Existing tasks for this job */}
              {availableTasks.length > 0 && mode === 'select' && (
                <div className="space-y-2">
                  <Label>Select an existing task</Label>
                  <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {availableTasks.map(task => {
                      const statusLabel = TASK_STATUSES[task.status as TaskStatus] ?? task.status
                      return (
                        <button
                          key={task.id}
                          onClick={() => handleSelectExisting(task)}
                          disabled={saving}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-slate-400 truncate mt-0.5">{task.description}</p>
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                            {statusLabel}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Already assigned indicator */}
              {availableTasks.length === 0 && mode === 'select' && (
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-md px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span>All tasks in this job are already on your My Work list.</span>
                </div>
              )}

              {/* Divider + Create new button / form */}
              {mode === 'select' && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs text-slate-400 uppercase tracking-wide">or</span>
                  </div>
                </div>
              )}

              {mode === 'select' ? (
                <button
                  onClick={() => setMode('create')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-slate-300 rounded-md text-sm font-medium text-slate-600 hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create a new task
                </button>
              ) : (
                <form onSubmit={handleCreateNew} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-slate-700">New Task</Label>
                    {availableTasks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMode('select')}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Back to existing tasks
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Task Title <span className="text-red-500">*</span></Label>
                    <Input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Email client, Call council, Review plans"
                      autoFocus
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

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={saving || !title.trim()}
                  >
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create & Add to My Work
                  </Button>
                </form>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
        </div>
      </div>
    </>
  )
}
