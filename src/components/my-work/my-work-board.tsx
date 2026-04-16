'use client'

import { useState, useMemo } from 'react'
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { AddItemForm } from './add-item-form'
import { InlineTimeLog } from './inline-time-log'

export interface MyItem {
  itemId: string
  title: string
  description: string | null
  status: string
  dueDate: string | null
  sortOrder: number
  taskId: string
  taskTitle: string
  taskStatus: string
  taskFeeType: string
  projectId: string
  jobNumber: string
  projectTitle: string
  projectStatus: string
  clientName: string | null
  taskHoursLogged: number
}

export interface ActiveProject {
  id: string
  jobNumber: string
  title: string
  clientName: string | null
}

export interface ActiveTask {
  id: string
  projectId: string
  title: string
  feeType: string
}

export interface ProjectRate {
  projectId: string
  hourlyRate: number
}

interface Props {
  myProfile: { id: string; fullName: string; defaultHourlyRate: number }
  items: MyItem[]
  activeProjects: ActiveProject[]
  activeTasks: ActiveTask[]
  projectRates: ProjectRate[]
}

type FilterTab = 'active' | 'completed' | 'all'

const ACTIVE_STATUSES = ['not_started', 'in_progress', 'on_hold']
const ACTIVE_PROJECT_STATUSES = ['active', 'on_hold']

export function MyWorkBoard({
  myProfile,
  items: initialItems,
  activeProjects,
  activeTasks,
  projectRates,
}: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [filter, setFilter] = useState<FilterTab>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTimeLogId, setExpandedTimeLogId] = useState<string | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [collapsedJobs, setCollapsedJobs] = useState<Set<string>>(new Set())
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set())

  // Filter items
  const filtered = items.filter(it => {
    if (filter === 'active') {
      if (!ACTIVE_STATUSES.includes(it.status)) return false
      if (!ACTIVE_PROJECT_STATUSES.includes(it.projectStatus)) return false
    } else if (filter === 'completed') {
      if (it.status !== 'completed') return false
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const hay = [it.title, it.taskTitle, it.jobNumber, it.projectTitle, it.clientName ?? '']
      if (!hay.some(v => v.toLowerCase().includes(q))) return false
    }

    return true
  })

  // Group into Job → Task → Items
  const jobGroups = useMemo(() => {
    const byJob = new Map<string, {
      jobId: string
      jobNumber: string
      projectTitle: string
      clientName: string | null
      tasks: Map<string, {
        taskId: string
        taskTitle: string
        taskFeeType: string
        taskHoursLogged: number
        items: MyItem[]
      }>
    }>()

    for (const it of filtered) {
      if (!byJob.has(it.projectId)) {
        byJob.set(it.projectId, {
          jobId: it.projectId,
          jobNumber: it.jobNumber,
          projectTitle: it.projectTitle,
          clientName: it.clientName,
          tasks: new Map(),
        })
      }
      const job = byJob.get(it.projectId)!
      if (!job.tasks.has(it.taskId)) {
        job.tasks.set(it.taskId, {
          taskId: it.taskId,
          taskTitle: it.taskTitle,
          taskFeeType: it.taskFeeType,
          taskHoursLogged: it.taskHoursLogged,
          items: [],
        })
      }
      job.tasks.get(it.taskId)!.items.push(it)
    }

    // Sort items by sort_order then title; sort tasks + jobs alphabetically
    const jobs = Array.from(byJob.values())
      .map(job => ({
        ...job,
        tasks: Array.from(job.tasks.values())
          .map(t => ({
            ...t,
            items: [...t.items].sort((a, b) =>
              a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)
            ),
          }))
          .sort((a, b) => a.taskTitle.localeCompare(b.taskTitle)),
      }))
      .sort((a, b) => b.jobNumber.localeCompare(a.jobNumber, undefined, { numeric: true }))
    return jobs
  }, [filtered])

  // Stats
  const activeItemCount = items.filter(it =>
    ACTIVE_STATUSES.includes(it.status) && ACTIVE_PROJECT_STATUSES.includes(it.projectStatus)
  ).length
  const dueThisWeekCount = items.filter(it =>
    it.dueDate && ACTIVE_STATUSES.includes(it.status)
    && isThisWeek(parseISO(it.dueDate), { weekStartsOn: 1 })
  ).length

  // Status cycling
  async function cycleStatus(itemId: string, currentStatus: string) {
    const list = TASK_STATUS_CYCLE
    const idx = list.indexOf(currentStatus as TaskStatus)
    const next = idx === -1 || idx === list.length - 1 ? list[0] : list[idx + 1]

    setItems(prev => prev.map(it =>
      it.itemId === itemId ? { ...it, status: next } : it
    ))

    const db = createClient() as any
    const { error } = await db.from('task_items').update({ status: next }).eq('id', itemId)

    if (error) {
      setItems(prev => prev.map(it =>
        it.itemId === itemId ? { ...it, status: currentStatus } : it
      ))
    } else {
      router.refresh()
    }
  }

  function handleItemAdded(newItem: MyItem) {
    setItems(prev => [newItem, ...prev])
  }

  function handleTimeLogged(taskId: string, hours: number) {
    setItems(prev => prev.map(it =>
      it.taskId === taskId
        ? { ...it, taskHoursLogged: it.taskHoursLogged + hours }
        : it
    ))
    setExpandedTimeLogId(null)
  }

  function toggleJob(jobId: string) {
    setCollapsedJobs(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  function toggleTask(taskId: string) {
    setCollapsedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const filterTabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'active', label: 'Active', count: activeItemCount },
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
            {activeItemCount} active item{activeItemCount !== 1 ? 's' : ''}
            {dueThisWeekCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">{dueThisWeekCount} due this week</span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowAddItem(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
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
            placeholder="Search items, tasks, jobs, clients…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Hierarchy */}
      {jobGroups.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 text-sm">
            {filter === 'active' ? 'No active items assigned to you.' : 'No items found.'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setShowAddItem(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add your first Item
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {jobGroups.map(job => {
            const isJobCollapsed = collapsedJobs.has(job.jobId)
            return (
              <div key={job.jobId} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                {/* Job header */}
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <button
                    onClick={() => toggleJob(job.jobId)}
                    className="flex items-center gap-2 min-w-0 text-left"
                  >
                    {isJobCollapsed
                      ? <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    }
                    <Link
                      href={`/projects/${job.jobNumber}/details`}
                      onClick={e => e.stopPropagation()}
                      className="font-mono font-medium text-sm text-slate-900 hover:underline shrink-0"
                    >
                      {job.jobNumber}
                    </Link>
                    <span className="text-sm text-slate-700 truncate">{job.projectTitle}</span>
                  </button>
                  {job.clientName && (
                    <span className="text-xs text-slate-500 truncate ml-4">{job.clientName}</span>
                  )}
                </div>

                {/* Tasks */}
                {!isJobCollapsed && (
                  <div className="divide-y divide-slate-100">
                    {job.tasks.map(task => {
                      const isTaskCollapsed = collapsedTasks.has(task.taskId)
                      const activeItemsInTask = task.items.filter(it => ACTIVE_STATUSES.includes(it.status)).length
                      return (
                        <div key={task.taskId}>
                          {/* Task header */}
                          <button
                            onClick={() => toggleTask(task.taskId)}
                            className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isTaskCollapsed
                                ? <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                : <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              }
                              <span className="text-sm font-medium text-slate-800 truncate">{task.taskTitle}</span>
                              <span className="text-xs text-slate-400 shrink-0">
                                · {task.items.length} item{task.items.length !== 1 ? 's' : ''}
                                {activeItemsInTask !== task.items.length && ` (${activeItemsInTask} active)`}
                              </span>
                            </div>
                            {task.taskHoursLogged > 0 && (
                              <span className="text-xs text-slate-500 tabular-nums shrink-0">
                                {task.taskHoursLogged}h logged
                              </span>
                            )}
                          </button>

                          {/* Items in task */}
                          {!isTaskCollapsed && (
                            <div className="divide-y divide-slate-50 bg-slate-50/30">
                              {task.items.map(item => (
                                <ItemRow
                                  key={item.itemId}
                                  item={item}
                                  expandedTimeLogId={expandedTimeLogId}
                                  onCycleStatus={() => cycleStatus(item.itemId, item.status)}
                                  onToggleTimeLog={() =>
                                    setExpandedTimeLogId(prev => prev === item.itemId ? null : item.itemId)
                                  }
                                  myProfile={myProfile}
                                  projectRates={projectRates}
                                  onTimeLogged={handleTimeLogged}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Item slide-over */}
      <AddItemForm
        open={showAddItem}
        onOpenChange={setShowAddItem}
        projects={activeProjects}
        tasks={activeTasks}
        staffId={myProfile.id}
        onItemAdded={handleItemAdded}
      />
    </div>
  )
}

// ─── Individual item row ─────────────────────────────────────────────────
function ItemRow({
  item,
  expandedTimeLogId,
  onCycleStatus,
  onToggleTimeLog,
  myProfile,
  projectRates,
  onTimeLogged,
}: {
  item: MyItem
  expandedTimeLogId: string | null
  onCycleStatus: () => void
  onToggleTimeLog: () => void
  myProfile: { id: string; fullName: string; defaultHourlyRate: number }
  projectRates: ProjectRate[]
  onTimeLogged: (taskId: string, hours: number) => void
}) {
  const statusLabel = TASK_STATUSES[item.status as TaskStatus] ?? item.status
  const statusColour = TASK_STATUS_COLOURS[item.status] ?? 'bg-slate-100 text-slate-600'
  const isOverdue = item.dueDate
    && isPast(parseISO(item.dueDate))
    && ACTIVE_STATUSES.includes(item.status)
  const isExpanded = expandedTimeLogId === item.itemId

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-2.5 pl-11 hover:bg-slate-50 transition-colors">
        {/* Status badge (clickable) */}
        <button
          onClick={onCycleStatus}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity shrink-0 ${statusColour}`}
          title="Click to change status"
        >
          {statusLabel}
        </button>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 truncate">{item.title}</p>
          {item.description && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{item.description}</p>
          )}
        </div>

        {/* Due date */}
        <div className={`text-xs whitespace-nowrap shrink-0 ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
          {item.dueDate ? format(parseISO(item.dueDate), 'd MMM yyyy') : '—'}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleTimeLog}
            className={`p-1.5 rounded transition-colors ${
              isExpanded
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Log time (goes to parent Task)"
          >
            <Clock className="h-4 w-4" />
          </button>
          <Link
            href={`/projects/${item.jobNumber}/tasks`}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Go to project tasks"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 pl-11 py-3 bg-blue-50/50">
          <InlineTimeLog
            taskId={item.taskId}
            projectId={item.projectId}
            staffId={myProfile.id}
            defaultHourlyRate={myProfile.defaultHourlyRate}
            feeType={item.taskFeeType}
            projectRates={projectRates}
            defaultDescription={item.title}
            onLogged={(hrs) => onTimeLogged(item.taskId, hrs)}
            onCancel={() => onToggleTimeLog()}
          />
        </div>
      )}
    </>
  )
}
