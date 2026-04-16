'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

const schema = z.object({
  project_id: z.string().min(1, 'Select a project'),
  task_id: z.string().optional(),
  staff_id: z.string().min(1, 'Select a staff member'),
  date: z.string().min(1, 'Date required'),
  hours: z.number().positive('Must be greater than 0'),
  description: z.string().optional(),
  is_billable: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface Project {
  id: string
  job_number: string
  title: string
  is_billable: boolean
}

interface Task {
  id: string
  project_id: string
  title: string
}

interface StaffMember {
  id: string
  full_name: string
  default_hourly_rate: number
}

interface TimesheetEntryFormProps {
  projects: Project[]
  tasks: Task[]
  staff: StaffMember[]
  currentStaffId: string | null
}

export function TimesheetEntryForm({ projects, tasks, staff, currentStaffId }: TimesheetEntryFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = format(new Date(), 'yyyy-MM-dd')

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_id: '',
      task_id: '',
      staff_id: currentStaffId ?? '',
      date: today,
      hours: undefined,
      description: '',
      is_billable: true,
    },
  })

  const selectedProjectId = watch('project_id')
  const selectedStaffId = watch('staff_id')
  const watchedHours = watch('hours')

  // Filter tasks to the selected project
  const projectTasks = tasks.filter(t => t.project_id === selectedProjectId)

  // Rate preview uses staff default rate (project-specific override resolved on submit)
  const selectedStaff = staff.find(s => s.id === selectedStaffId)
  const previewRate = selectedStaff?.default_hourly_rate ?? null
  const validHours = !isNaN(watchedHours) && watchedHours > 0 ? watchedHours : null
  const previewAmount = previewRate && validHours ? previewRate * validHours : null

  // When project changes: reset task, update billable default to match project
  function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setValue('task_id', '')
    const project = projects.find(p => p.id === e.target.value)
    if (project) setValue('is_billable', project.is_billable)
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    setError(null)

    const supabase = createClient()
    const db = supabase as any

    // Resolve rate: project-specific override → staff default
    let rate = selectedStaff?.default_hourly_rate ?? 0
    const { data: override } = await db
      .from('project_staff_rates')
      .select('hourly_rate')
      .eq('project_id', values.project_id)
      .eq('staff_id', values.staff_id)
      .maybeSingle()
    if (override?.hourly_rate) rate = override.hourly_rate

    const { error: err } = await db.from('time_entries').insert({
      project_id: values.project_id,
      task_id: values.task_id || null,
      staff_id: values.staff_id,
      date: values.date,
      hours: values.hours,
      description: values.description?.trim() || null,
      is_billable: values.is_billable,
      rate_at_time: rate,
    })

    if (err) {
      setError('Failed to log time. Please try again.')
      setSubmitting(false)
      return
    }

    // Reset but keep project + staff + billable for quick back-to-back logging
    reset({
      project_id: values.project_id,
      task_id: '',
      staff_id: currentStaffId ?? values.staff_id,
      date: today,
      hours: undefined,
      description: '',
      is_billable: values.is_billable,
    })

    router.refresh()
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Staff */}
        <div className="space-y-1">
          <Label>Staff Member <span className="text-red-500">*</span></Label>
          <select
            {...register('staff_id')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Select staff —</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
          {errors.staff_id && (
            <p className="text-xs text-red-600">{errors.staff_id.message}</p>
          )}
        </div>

        {/* Date */}
        <div className="space-y-1">
          <Label>Date <span className="text-red-500">*</span></Label>
          <Input type="date" {...register('date')} />
          {errors.date && (
            <p className="text-xs text-red-600">{errors.date.message}</p>
          )}
        </div>

        {/* Project */}
        <div className="space-y-1">
          <Label>Project <span className="text-red-500">*</span></Label>
          <select
            {...register('project_id', { onChange: handleProjectChange })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Select project —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.job_number} — {p.title}
              </option>
            ))}
          </select>
          {errors.project_id && (
            <p className="text-xs text-red-600">{errors.project_id.message}</p>
          )}
        </div>

        {/* Hours */}
        <div className="space-y-1">
          <Label>Hours <span className="text-red-500">*</span></Label>
          <Input
            type="number"
            step="0.25"
            min="0.25"
            placeholder="e.g. 2.5"
            {...register('hours', { valueAsNumber: true })}
          />
          {errors.hours ? (
            <p className="text-xs text-red-600">{errors.hours.message}</p>
          ) : previewRate !== null ? (
            <p className="text-xs text-slate-500">
              Rate: {formatCurrency(previewRate)}/h
              {previewAmount !== null && (
                <> &rarr; <span className="font-medium">{formatCurrency(previewAmount)}</span></>
              )}
            </p>
          ) : null}
        </div>

        {/* Task — disabled until project selected */}
        <div className="space-y-1">
          <Label>Task</Label>
          <select
            {...register('task_id')}
            disabled={!selectedProjectId}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— No task —</option>
            {projectTasks.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>

        {/* Task Description */}
        <div className="space-y-1">
          <Label>Task Description</Label>
          <Input
            {...register('description')}
            placeholder="Optional description of work done"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            {...register('is_billable')}
            className="rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Billable</span>
        </label>
        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting ? 'Logging…' : 'Log Time'}
          </Button>
        </div>
      </div>
    </form>
  )
}
