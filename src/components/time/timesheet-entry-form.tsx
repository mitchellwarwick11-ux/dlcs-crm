'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, stripJobNumberPrefix } from '@/lib/utils/formatters'
import { USER_ROLES } from '@/lib/constants/roles'
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
  role?: string
  default_hourly_rate: number
}

interface RoleOption {
  role_key: string
  label: string
  hourly_rate: number
}

interface TimesheetEntryFormProps {
  projects: Project[]
  tasks: Task[]
  staff: StaffMember[]
  roleRates: RoleOption[]
  currentStaffId: string | null
}

export function TimesheetEntryForm({ projects, tasks, staff, roleRates, currentStaffId }: TimesheetEntryFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actingRole, setActingRole] = useState('')
  const [roleTouched, setRoleTouched] = useState(false)

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

  const projectTasks = tasks.filter(t => t.project_id === selectedProjectId)

  const selectedStaff = staff.find(s => s.id === selectedStaffId)

  useEffect(() => {
    if (!roleTouched) setActingRole(selectedStaff?.role ?? '')
  }, [selectedStaff?.role, roleTouched])

  // Rate preview: prefer global role_rates for the acting role; project override resolves on submit
  const previewRate = (() => {
    if (actingRole) {
      const r = roleRates.find(rr => rr.role_key === actingRole)
      if (r) return Number(r.hourly_rate)
    }
    return selectedStaff?.default_hourly_rate ?? null
  })()
  const validHours = !isNaN(watchedHours) && watchedHours > 0 ? watchedHours : null
  const previewAmount = previewRate && validHours ? previewRate * validHours : null

  function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setValue('task_id', '')
    const project = projects.find(p => p.id === e.target.value)
    if (project) setValue('is_billable', project.is_billable)
  }

  function handleRoleChange(role: string) {
    setActingRole(role)
    setRoleTouched(true)
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    setError(null)

    const supabase = createClient()
    const db = supabase as any

    // Resolve rate using acting role: project override → global role_rates → staff default
    const role = actingRole || selectedStaff?.role || null
    let rate = selectedStaff?.default_hourly_rate ?? 0
    if (role) {
      const { data: override } = await db
        .from('project_role_rates')
        .select('hourly_rate')
        .eq('project_id', values.project_id)
        .eq('role_key', role)
        .maybeSingle()
      if (override?.hourly_rate) {
        rate = Number(override.hourly_rate)
      } else {
        const global = roleRates.find(r => r.role_key === role)
        if (global) rate = Number(global.hourly_rate)
      }
    }

    const defaultRole = selectedStaff?.role ?? null
    const actingRoleToSave = role && role !== defaultRole ? role : null

    const { error: err } = await db.from('time_entries').insert({
      project_id: values.project_id,
      task_id: values.task_id || null,
      staff_id: values.staff_id,
      date: values.date,
      hours: values.hours,
      description: values.description?.trim() || null,
      is_billable: values.is_billable,
      rate_at_time: rate,
      acting_role: actingRoleToSave,
    })

    if (err) {
      setError('Failed to log time. Please try again.')
      setSubmitting(false)
      return
    }

    setRoleTouched(false)
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

        {/* Acting Role */}
        <div className="space-y-1">
          <Label>Acting As</Label>
          <select
            value={actingRole}
            onChange={e => handleRoleChange(e.target.value)}
            disabled={!selectedStaffId}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— Select role —</option>
            {roleRates.map(r => (
              <option key={r.role_key} value={r.role_key}>
                {r.label}{selectedStaff?.role === r.role_key ? ' (default)' : ''}
              </option>
            ))}
          </select>
          {actingRole && selectedStaff?.role && actingRole !== selectedStaff.role && (
            <p className="text-xs text-amber-700">Differs from default ({USER_ROLES[selectedStaff.role] ?? selectedStaff.role.replace(/_/g, ' ')})</p>
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
                {p.job_number} — {stripJobNumberPrefix(p.title, p.job_number)}
              </option>
            ))}
          </select>
          {errors.project_id && (
            <p className="text-xs text-red-600">{errors.project_id.message}</p>
          )}
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
        <div className="space-y-1 md:col-span-2">
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
