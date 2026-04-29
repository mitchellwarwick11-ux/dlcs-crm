'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { TaskCard } from '@/components/tasks/task-card'
import { ScheduleEntryModal } from '@/components/fieldwork/schedule-entry-modal'
import type { ScheduleEntryFull } from '@/types/database'

type TaskRow = any

interface StaffOption     { id: string; full_name: string; role?: string }
interface EquipmentOption { id: string; label: string }
interface TaskOption      { id: string; project_id: string; title: string }
interface ProjectOption {
  id: string
  job_number: string
  title: string
  site_address: string | null
  suburb: string | null
  clients: { name: string; company_name: string | null } | null
  job_manager: { full_name: string } | null
}

export interface InvoiceLink {
  id: string
  invoice_number: string
  status: string
  amount: number
}

interface Props {
  projectId: string
  jobNumber: string
  tasks: TaskRow[]
  workDoneMap: Record<string, number>
  invoicedMap: Record<string, number>
  invoicesByTaskMap: Record<string, InvoiceLink[]>
  // Schedule modal data
  scheduleProjects: ProjectOption[]
  scheduleAllTasks: TaskOption[]
  fieldSurveyors: StaffOption[]
  officeSurveyors: StaffOption[]
  equipment: EquipmentOption[]
  allStaff: StaffOption[]
  canEditSchedule: boolean
  allScheduleEntries: ScheduleEntryFull[]
}

export function TasksView({
  projectId,
  jobNumber,
  tasks,
  workDoneMap,
  invoicedMap,
  invoicesByTaskMap,
  scheduleProjects,
  scheduleAllTasks,
  fieldSurveyors,
  officeSurveyors,
  equipment,
  allStaff,
  canEditSchedule,
  allScheduleEntries,
}: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null)

  function handleSchedule(taskId: string) {
    setScheduleTaskId(taskId)
    setScheduleOpen(true)
  }

  // Ensure the selected task and project are present in the modal's lists,
  // even if they're filtered out by status (e.g. completed task).
  const mergedTasks: TaskOption[] = (() => {
    const byId = new Map(scheduleAllTasks.map(t => [t.id, t]))
    for (const t of tasks) {
      if (!byId.has(t.id)) {
        byId.set(t.id, { id: t.id, project_id: projectId, title: t.title })
      }
    }
    return Array.from(byId.values())
  })()

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tasks.map(task => {
          const assignedStaff = (task.task_assignments ?? [])
            .map((a: any) => a.staff_profiles)
            .filter(Boolean)

          return (
            <TaskCard
              key={task.id}
              task={task}
              assignedStaff={assignedStaff}
              workDone={workDoneMap[task.id] ?? 0}
              invoiced={invoicedMap[task.id] ?? 0}
              invoices={invoicesByTaskMap[task.id] ?? []}
              jobNumber={jobNumber}
              onSchedule={canEditSchedule ? handleSchedule : undefined}
            />
          )
        })}
      </div>

      <ScheduleEntryModal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        entry={null}
        prefillDate={format(new Date(), 'yyyy-MM-dd')}
        prefillProjectId={projectId}
        prefillTaskId={scheduleTaskId ?? ''}
        projects={scheduleProjects}
        allTasks={mergedTasks}
        fieldSurveyors={fieldSurveyors}
        officeSurveyors={officeSurveyors}
        equipment={equipment}
        allStaff={allStaff}
        allEntries={allScheduleEntries}
        canEdit={canEditSchedule}
      />
    </>
  )
}
