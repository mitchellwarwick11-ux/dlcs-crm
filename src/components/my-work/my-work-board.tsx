'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO, isPast, isThisWeek } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import {
  TASK_STATUSES,
  TASK_STATUS_COLOURS,
  TASK_STATUS_CYCLE,
} from '@/lib/constants/statuses'
import type { TaskStatus } from '@/lib/constants/statuses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Clock,
  ExternalLink,
  Search,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { QuickAddTaskForm } from './quick-add-task-form'
import { InlineTimeLog } from './inline-time-log'

export interface MyTask {
  taskId: string
  title: string
  description: string | null
  status: string
  feeType: string
  dueDate: string | null
  projectId: string
  jobNumber: string
  projectTitle: string
  projectStatus: string
  clientName: string | null
  totalHoursLogged: number
}

export interface ActiveProject {
  id: string
  jobNumber: string
  title: string
  clientName: string | null
}

export interface ProjectRate {
  projectId: string
  hourlyRate: number
}

interface Props {
  myProfile: { id: string; fullName: string; defaultHourlyRate: number }
  tasks: MyTask[]
  activeProjects: ActiveProject[]
  projectRates: ProjectRate[]
}

type FilterTab = 'active' | 'completed' | 'all'
type SortCol = 'due_date' | 'job_number' | 'status' | 'task' | 'client' | 'hours'
type SortDir = 'asc' | 'desc'

const ACTIVE_STATUSES = ['not_started', 'in_progress', 'on_hold']
const ACTIVE_PROJECT_STATUSES = ['active', 'on_hold']

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  not_started: 1,
  on_hold: 2,
  completed: 3,
  cancelled: 4,
}

export function MyWorkBoard({ myProfile, tasks: initialTasks, activeProjects, projectRates }: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [filter, setFilter] = useState<FilterTab>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('due_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expandedTimeLogId, setExpandedTimeLogId] = useState<string | null>(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  // Filter
  const filtered = tasks.filter(t => {
    if (filter === 'active') {
      if (!ACTIVE_STATUSES.includes(t.status)) return false
      if (!ACTIVE_PROJECT_STATUSES.includes(t.projectStatus)) return false
    } else if (filter === 'completed') {
      if (t.status !== 'completed') return false
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches = [t.title, t.jobNumber, t.projectTitle, t.clientName ?? '']
        .some(v => v.toLowerCase().includes(q))
      if (!matches) return false
    }

    return true
  })

  // Sort
  function getSortValue(t: MyTask): string | number {
    switch (sortCol) {
      case 'due_date':
        return t.dueDate ?? '9999-12-31'
      case 'job_number':
        return t.jobNumber
      case 'status':
        return STATUS_ORDER[t.status] ?? 99
      case 'task':
        return t.title
      case 'client':
        return t.clientName ?? ''
      case 'hours':
        return t.totalHoursLogged
    }
  }

  const sorted = [...filtered].sort((a, b) => {
    const av = getSortValue(a)
    const bv = getSortValue(b)
    let cmp = 0
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv
    } else {
      cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true })
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  // Status cycling
  async function cycleStatus(taskId: string, currentStatus: string) {
    const cycleList = TASK_STATUS_CYCLE
    const currentIdx = cycleList.indexOf(currentStatus as TaskStatus)
    const nextStatus = currentIdx === -1 || currentIdx === cycleList.length - 1
      ? cycleList[0]
      : cycleList[currentIdx + 1]

    setTasks(prev => prev.map(t =>
      t.taskId === taskId ? { ...t, status: nextStatus } : t
    ))

    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('project_tasks')
      .update({ status: nextStatus })
      .eq('id', taskId)

    if (error) {
      setTasks(prev => prev.map(t =>
        t.taskId === taskId ? { ...t, status: currentStatus } : t
      ))
    } else {
      router.refresh()
    }
  }

  // Task added callback
  function handleTaskAdded(newTask: MyTask) {
    setTasks(prev => [newTask, ...prev])
  }

  // Time logged callback
  function handleTimeLogged(taskId: string, hours: number) {
    setTasks(prev => prev.map(t =>
      t.taskId === taskId ? { ...t, totalHoursLogged: t.totalHoursLogged + hours } : t
    ))
    setExpandedTimeLogId(null)
  }

  // Stats
  const activeCount = tasks.filter(t => ACTIVE_STATUSES.includes(t.status) && ACTIVE_PROJECT_STATUSES.includes(t.projectStatus)).length
  const dueThisWeek = tasks.filter(t =>
    t.dueDate && ACTIVE_STATUSES.includes(t.status) && isThisWeek(parseISO(t.dueDate), { weekStartsOn: 1 })
  ).length

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 text-slate-300" />
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1 text-slate-600" />
      : <ChevronDown className="h-3 w-3 ml-1 text-slate-600" />
  }

  function ThSort({ col, children, className = '' }: { col: SortCol; children: React.ReactNode; className?: string }) {
    return (
      <th
        className={`text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 hover:bg-slate-100 transition-colors ${className}`}
        onClick={() => handleSort(col)}
      >
        <span className="inline-flex items-center">
          {children}
          <SortIcon col={col} />
        </span>
      </th>
    )
  }

  const filterTabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'active', label: 'Active', count: activeCount },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Work</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount} active task{activeCount !== 1 ? 's' : ''}
            {dueThisWeek > 0 && (
              <span className="ml-2 text-amber-600 font-medium">{dueThisWeek} due this week</span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowQuickAdd(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Quick Add Task
        </Button>
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-1.5 text-xs ${filter === tab.key ? 'text-slate-300' : 'text-slate-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks, jobs, clients…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 text-sm">
            {filter === 'active' ? 'No active tasks assigned to you.' : 'No tasks found.'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setShowQuickAdd(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add a Task
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <ThSort col="job_number" className="whitespace-nowrap">Job #</ThSort>
                  <ThSort col="client">Client</ThSort>
                  <ThSort col="task">Task</ThSort>
                  <ThSort col="status">Status</ThSort>
                  <ThSort col="due_date" className="whitespace-nowrap">Due Date</ThSort>
                  <ThSort col="hours">Hours</ThSort>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(task => {
                  const isOverdue = task.dueDate
                    && isPast(parseISO(task.dueDate))
                    && ACTIVE_STATUSES.includes(task.status)

                  return (
                    <TaskRows
                      key={task.taskId}
                      task={task}
                      isOverdue={!!isOverdue}
                      expandedTimeLogId={expandedTimeLogId}
                      onCycleStatus={() => cycleStatus(task.taskId, task.status)}
                      onToggleTimeLog={() =>
                        setExpandedTimeLogId(prev => prev === task.taskId ? null : task.taskId)
                      }
                      myProfile={myProfile}
                      projectRates={projectRates}
                      onTimeLogged={handleTimeLogged}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Add slide-over */}
      <QuickAddTaskForm
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        projects={activeProjects}
        staffId={myProfile.id}
        onTaskAdded={handleTaskAdded}
      />
    </div>
  )
}

// Extracted row + optional inline time log row
function TaskRows({
  task,
  isOverdue,
  expandedTimeLogId,
  onCycleStatus,
  onToggleTimeLog,
  myProfile,
  projectRates,
  onTimeLogged,
}: {
  task: MyTask
  isOverdue: boolean
  expandedTimeLogId: string | null
  onCycleStatus: () => void
  onToggleTimeLog: () => void
  myProfile: { id: string; fullName: string; defaultHourlyRate: number }
  projectRates: ProjectRate[]
  onTimeLogged: (taskId: string, hours: number) => void
}) {
  const statusLabel = TASK_STATUSES[task.status as TaskStatus] ?? task.status
  const statusColour = TASK_STATUS_COLOURS[task.status] ?? 'bg-slate-100 text-slate-600'

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3 font-mono font-medium text-slate-900 whitespace-nowrap">
          <Link href={`/projects/${task.jobNumber}/tasks`} className="hover:underline">
            {task.jobNumber}
          </Link>
        </td>
        <td className="px-4 py-3 text-slate-600 text-xs truncate max-w-[140px]">
          {task.clientName ?? '—'}
        </td>
        <td className="px-4 py-3 text-slate-900">
          <div className="max-w-[240px]">
            <p className="truncate font-medium text-sm">{task.title}</p>
            {task.description && (
              <p className="truncate text-xs text-slate-400 mt-0.5">{task.description}</p>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={onCycleStatus}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${statusColour}`}
            title="Click to change status"
          >
            {statusLabel}
          </button>
        </td>
        <td className={`px-4 py-3 text-xs whitespace-nowrap ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
          {task.dueDate ? format(parseISO(task.dueDate), 'd MMM yyyy') : '—'}
        </td>
        <td className="px-4 py-3 text-slate-700 tabular-nums whitespace-nowrap">
          {task.totalHoursLogged > 0 ? `${task.totalHoursLogged}h` : '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleTimeLog}
              className={`p-1.5 rounded transition-colors ${
                expandedTimeLogId === task.taskId
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title="Log time"
            >
              <Clock className="h-4 w-4" />
            </button>
            <Link
              href={`/projects/${task.jobNumber}/tasks`}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              title="Go to project tasks"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </td>
      </tr>
      {expandedTimeLogId === task.taskId && (
        <tr className="bg-blue-50/50">
          <td colSpan={7} className="px-4 py-3">
            <InlineTimeLog
              taskId={task.taskId}
              projectId={task.projectId}
              staffId={myProfile.id}
              defaultHourlyRate={myProfile.defaultHourlyRate}
              feeType={task.feeType}
              projectRates={projectRates}
              onLogged={(hours) => onTimeLogged(task.taskId, hours)}
              onCancel={() => onToggleTimeLog()}
            />
          </td>
        </tr>
      )}
    </>
  )
}
