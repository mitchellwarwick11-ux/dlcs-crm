'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { resolveRate } from '@/lib/utils/rate-calculator'
import { formatCurrency } from '@/lib/utils/formatters'
import { USER_ROLES } from '@/lib/constants/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

const schema = z.object({
  staff_id:    z.string().min(1, 'Select a staff member'),
  task_id:     z.string().optional(),
  date:        z.string().min(1, 'Date required'),
  hours:       z.number().positive('Must be greater than 0'),
  description: z.string().optional(),
  is_billable: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface StaffMember {
  id: string
  full_name: string
  role: string
  default_hourly_rate: number
}

interface Task {
  id: string
  title: string
  fee_type: string
  status: string
}

interface ProjectRate {
  role_key: string
  hourly_rate: number
}

interface RoleOption {
  role_key: string
  label: string
  hourly_rate: number
}

interface LogTimeFormProps {
  projectId: string
  staff: StaffMember[]
  tasks: Task[]
  projectRates: ProjectRate[]
  roleRates: RoleOption[]
  defaultBillable: boolean
}

export function LogTimeForm({ projectId, staff, tasks, projectRates, roleRates, defaultBillable }: LogTimeFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const [staffId, setStaffId]       = useState('')
  const [taskId, setTaskId]         = useState('')
  const [actingRole, setActingRole] = useState('')
  const [roleTouched, setRoleTouched] = useState(false)
  const [isBillable, setIsBillable] = useState(defaultBillable)
  const [isVariation, setIsVariation] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      staff_id: '', task_id: '', date: today,
      hours: undefined, description: '', is_billable: defaultBillable,
    },
  })

  const watchedHours = watch('hours')

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')

  const selectedStaff = staff.find(s => s.id === staffId)

  // Default the role to the staff member's default role until the user picks one explicitly
  useEffect(() => {
    if (!roleTouched) {
      setActingRole(selectedStaff?.role ?? '')
    }
  }, [selectedStaff?.role, roleTouched])

  const previewRate = staffId
    ? resolveRate(staffId, staff, projectRates, actingRole || null, roleRates)
    : null
  const validHours   = !isNaN(watchedHours) && watchedHours > 0 ? watchedHours : null
  const previewAmount = previewRate && validHours ? previewRate * validHours : null

  function handleStaffChange(id: string) {
    setStaffId(id)
    setValue('staff_id', id)
    if (!roleTouched) {
      const s = staff.find(m => m.id === id)
      setActingRole(s?.role ?? '')
    }
  }

  function handleRoleChange(role: string) {
    setActingRole(role)
    setRoleTouched(true)
  }

  function handleTaskChange(id: string) {
    setTaskId(id)
    if (!id) { setIsBillable(defaultBillable); return }
    const task = activeTasks.find(t => t.id === id)
    if (task?.fee_type === 'non_billable') {
      setIsBillable(false)
    } else {
      setIsBillable(defaultBillable)
    }
  }

  function handleVariationToggle(checked: boolean) {
    setIsVariation(checked)
    if (checked) setIsBillable(true)
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    setError(null)
    const db = createClient() as any

    if (isVariation && !taskId) {
      setError('Pick the task this variation relates to.')
      setSubmitting(false)
      return
    }

    const rate = resolveRate(staffId, staff, projectRates, actingRole || null, roleRates)
    const defaultRole = selectedStaff?.role ?? null
    // Only persist acting_role when it differs from the staff member's default — keeps
    // "no override" rows as NULL, matching all pre-migration data.
    const actingRoleToSave = actingRole && actingRole !== defaultRole ? actingRole : null

    const { error: err } = await db.from('time_entries').insert({
      project_id:   projectId,
      task_id:      taskId || null,
      staff_id:     staffId,
      date:         values.date,
      hours:        values.hours,
      description:  values.description?.trim() || null,
      is_billable:  isBillable,
      is_variation: isVariation,
      rate_at_time: rate,
      acting_role:  actingRoleToSave,
    })

    if (err) {
      setError('Failed to log time. Please try again.')
      setSubmitting(false)
      return
    }

    setTaskId('')
    setIsVariation(false)
    setRoleTouched(false)
    reset({
      staff_id: staffId, task_id: '', date: values.date,
      hours: undefined, description: '', is_billable: isBillable,
    })
    router.refresh()
    setSubmitting(false)
  }

  return (
    <form
      onSubmit={handleSubmit(data => onSubmit({ ...data, staff_id: staffId, task_id: taskId, is_billable: isBillable }))}
      className="space-y-4"
    >
      {/* Row 1: Staff | Role | Date | Hours */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        <div className="space-y-1">
          <Label>Staff Member <span className="text-red-500">*</span></Label>
          <select
            value={staffId}
            onChange={e => handleStaffChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Select staff —</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
          {errors.staff_id && <p className="text-xs text-red-600">{errors.staff_id.message}</p>}
        </div>

        {/* Acting Role */}
        <div className="space-y-1">
          <Label>Acting As</Label>
          <select
            value={actingRole}
            onChange={e => handleRoleChange(e.target.value)}
            disabled={!staffId}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— Select role —</option>
            {roleRates.map(r => (
              <option key={r.role_key} value={r.role_key}>
                {r.label}{selectedStaff && r.role_key === selectedStaff.role ? ' (default)' : ''}
              </option>
            ))}
          </select>
          {actingRole && selectedStaff && actingRole !== selectedStaff.role && (
            <p className="text-xs text-amber-700">Differs from default ({USER_ROLES[selectedStaff.role] ?? selectedStaff.role.replace(/_/g, ' ')})</p>
          )}
        </div>

        <div className="space-y-1">
          <Label>Date <span className="text-red-500">*</span></Label>
          <Input type="date" {...register('date')} />
          {errors.date && <p className="text-xs text-red-600">{errors.date.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>Hours <span className="text-red-500">*</span></Label>
          <Input type="number" step="0.25" min="0.25" placeholder="e.g. 2.5"
            {...register('hours', { valueAsNumber: true })} />
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
      </div>

      {/* Row 2: Task | Task Description | Variation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">

        <div className="space-y-1">
          <Label>Task {isVariation && <span className="text-red-500">*</span>}</Label>
          <select
            value={taskId}
            onChange={e => handleTaskChange(e.target.value)}
            className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
              isVariation ? 'border-amber-300 bg-amber-50/40' : 'border-input'
            }`}
          >
            <option value="">— No task —</option>
            {activeTasks.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          {isVariation && (
            <p className="text-xs text-amber-700">Variation will be billed hourly under this task.</p>
          )}
        </div>

        <div className="space-y-1">
          <Label>Task Description</Label>
          <Input {...register('description')} placeholder="Description of work done" />
        </div>

        <div className="space-y-1">
          <Label className="invisible">.</Label>
          <label className="flex items-start gap-2 cursor-pointer select-none rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={isVariation}
              onChange={e => handleVariationToggle(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <div>
              <p className="text-sm font-medium text-slate-700">Variation</p>
              <p className="text-xs text-slate-400">Extra work outside fixed fee scope</p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isBillable}
            onChange={e => setIsBillable(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Billable</span>
        </label>
        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting || !staffId}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting ? 'Logging…' : 'Log Time'}
          </Button>
        </div>
      </div>
    </form>
  )
}
