'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import type { StaffProfile, RoleRate } from '@/types/database'
import { TASK_STATUSES, FEE_TYPES } from '@/lib/constants/statuses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  fee_type: z.enum(['fixed', 'hourly', 'non_billable']),
  quoted_amount: z.number().min(0).nullable().optional(),
  due_date: z.string().nullable().optional(),
  status: z.enum(['not_started', 'in_progress', 'on_hold', 'completed', 'cancelled']).optional(),
  staff_ids: z.array(z.string()),
  approval_prepared_by: z.string().nullable().optional(),
  approval_approved_by: z.string().nullable().optional(),
  approval_method: z.enum(['email', 'phone']).nullable().optional(),
  approval_date: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.fee_type !== 'fixed') return
  if (!data.quoted_amount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quoted_amount'], message: 'Quoted amount is required for Fixed Fee tasks' })
  }
  if (!data.approval_prepared_by) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['approval_prepared_by'], message: 'Required' })
  }
  if (!data.approval_approved_by || !data.approval_approved_by.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['approval_approved_by'], message: 'Required' })
  }
  if (!data.approval_method) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['approval_method'], message: 'Select one' })
  }
  if (!data.approval_date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['approval_date'], message: 'Required' })
  }
})

type TaskFormValues = z.infer<typeof taskSchema>

interface TaskFormProps {
  mode: 'create' | 'edit'
  projectId: string
  jobNumber: string
  taskId?: string
  roleRates: RoleRate[]
  staff: Pick<StaffProfile, 'id' | 'full_name' | 'role'>[]
  initialValues?: Partial<TaskFormValues>
  initialStaffIds?: string[]
}

export function TaskForm({
  mode, projectId, jobNumber, taskId, roleRates, staff, initialValues, initialStaffIds = []
}: TaskFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<string[]>(initialStaffIds)

  type FeeType = 'fixed' | 'hourly' | 'non_billable'
  const initialFeeType = (initialValues?.fee_type ?? 'hourly') as FeeType
  const [feeType, setFeeType] = useState<FeeType>(initialFeeType)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      fee_type: initialFeeType,
      quoted_amount: null,
      due_date: null,
      status: 'not_started',
      staff_ids: initialStaffIds,
      approval_prepared_by: null,
      approval_approved_by: '',
      approval_method: null,
      approval_date: null,
      ...initialValues,
    },
  })

  const [approvalMethod, setApprovalMethod] = useState<'email' | 'phone' | null>(
    (initialValues?.approval_method as 'email' | 'phone' | null | undefined) ?? null
  )
  function selectApprovalMethod(m: 'email' | 'phone') {
    setApprovalMethod(m)
    setValue('approval_method', m)
  }

  const BILLING_DESCRIPTIONS: Record<FeeType, string> = {
    fixed:        'Fixed Fee — an agreed price regardless of hours spent.',
    hourly:       'Hourly — billed based on time logged against this task.',
    non_billable: 'Non-Billable — time is tracked but not charged to the client.',
  }

  function selectFeeType(type: FeeType) {
    setFeeType(type)
    setValue('fee_type', type)
  }

  function toggleStaff(staffId: string) {
    setSelectedStaff(prev => {
      const next = prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
      setValue('staff_ids', next)
      return next
    })
  }

  function toggleRole(memberIds: string[]) {
    setSelectedStaff(prev => {
      const allSelected = memberIds.every(id => prev.includes(id))
      const next = allSelected
        ? prev.filter(id => !memberIds.includes(id))
        : [...prev, ...memberIds.filter(id => !prev.includes(id))]
      setValue('staff_ids', next)
      return next
    })
  }

  // Group staff by role for display
  const roleMap: Record<string, string> = {}
  for (const r of roleRates) roleMap[r.role_key] = r.label

  const staffByRole: Record<string, { label: string; sortOrder: number; members: typeof staff }> = {}
  for (const s of staff) {
    if (!staffByRole[s.role]) {
      const rr = roleRates.find(r => r.role_key === s.role)
      staffByRole[s.role] = { label: rr?.label ?? s.role, sortOrder: rr?.sort_order ?? 99, members: [] }
    }
    staffByRole[s.role].members.push(s)
  }
  const sortedRoles = Object.entries(staffByRole).sort((a, b) => a[1].sortOrder - b[1].sortOrder)

  async function onSubmit(values: TaskFormValues) {
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const db = supabase as any

    // Approval fields are stored regardless of fee type so hourly tasks can also
    // record their quote acceptance. Validation only requires them for Fixed Fee.
    const payload = {
      title: values.title.trim(),
      description: values.description?.trim() || null,
      fee_type: values.fee_type,
      quoted_amount: values.quoted_amount ?? null,
      due_date: values.due_date || null,
      approval_prepared_by: values.approval_prepared_by || null,
      approval_approved_by: values.approval_approved_by?.trim() || null,
      approval_method: values.approval_method ?? null,
      approval_date: values.approval_date || null,
      ...(mode === 'edit' && values.status ? { status: values.status } : {}),
    }

    let taskId_ = taskId

    if (mode === 'create') {
      const { data, error: err } = await db
        .from('project_tasks')
        .insert({ ...payload, project_id: projectId, status: 'not_started', sort_order: 0 })
        .select()
        .single()
      if (err || !data) { setError(`Failed to create task: ${err?.message}`); setSubmitting(false); return }
      taskId_ = data.id
    } else {
      const { error: err } = await db.from('project_tasks').update(payload).eq('id', taskId)
      if (err) { setError(`Failed to update task: ${err?.message}`); setSubmitting(false); return }
    }

    // Sync staff assignments: delete all then re-insert
    await db.from('task_assignments').delete().eq('task_id', taskId_)
    if (selectedStaff.length > 0) {
      await db.from('task_assignments').insert(
        selectedStaff.map(staff_id => ({ task_id: taskId_, staff_id }))
      )
    }

    router.push(`/projects/${jobNumber}/tasks`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(data => onSubmit({ ...data, staff_ids: selectedStaff }))} className="space-y-6">

      {/* Basic details */}
      <Card>
        <CardHeader><CardTitle>Task Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
            <Input id="title" {...register('title')} placeholder="e.g. Draft DP" />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} rows={2} placeholder="Any notes about this task…" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="due_date">Due Date</Label>
            <Input id="due_date" {...register('due_date')} type="date" className="max-w-xs" />
          </div>
          {mode === 'edit' && (
            <div className="space-y-1">
              <Label>Status</Label>
              <select {...register('status')} className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm">
                {Object.entries(TASK_STATUSES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fee type & amount */}
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <p className="text-sm text-muted-foreground">
            {BILLING_DESCRIPTIONS[feeType] ?? ''}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {(['fixed', 'hourly', 'non_billable'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => selectFeeType(type)}
                className={cn(
                  'flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors',
                  feeType === type
                    ? type === 'non_billable'
                      ? 'border-slate-500 bg-slate-500 text-white'
                      : 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                )}
              >
                {FEE_TYPES[type]}
              </button>
            ))}
          </div>

          {feeType !== 'non_billable' && (
            <div className="space-y-1">
              <Label htmlFor="quoted_amount">
                {feeType === 'fixed' ? 'Quoted Amount' : 'Budget (optional)'}
                {feeType === 'fixed' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <Input
                  id="quoted_amount"
                  {...register('quoted_amount', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-6"
                />
              </div>
              {errors.quoted_amount && <p className="text-xs text-red-500">{errors.quoted_amount.message}</p>}
              <p className="text-xs text-slate-400">
                {feeType === 'fixed'
                  ? 'The agreed fixed price for this task.'
                  : 'Optional cap. Financial tracking shows uninvoiced work regardless.'}
              </p>
            </div>
          )}

          <div className="pt-4 mt-2 border-t border-slate-200 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Approval Reference</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {feeType === 'fixed'
                    ? 'How this fixed fee was quoted and approved (e.g. phone call or email with the client).'
                    : 'Optional — record the quote acceptance backing this work (e.g. phone call or email with the client).'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="approval_prepared_by">
                    Quote prepared by {feeType === 'fixed' && <span className="text-red-500">*</span>}
                  </Label>
                  <select
                    id="approval_prepared_by"
                    {...register('approval_prepared_by')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select staff…</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                  {errors.approval_prepared_by && <p className="text-xs text-red-500">{errors.approval_prepared_by.message}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="approval_approved_by">
                    Approved by {feeType === 'fixed' && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="approval_approved_by"
                    {...register('approval_approved_by')}
                    placeholder="Client name"
                  />
                  {errors.approval_approved_by && <p className="text-xs text-red-500">{errors.approval_approved_by.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Quoted via {feeType === 'fixed' && <span className="text-red-500">*</span>}</Label>
                  <div className="flex gap-2">
                    {(['email', 'phone'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => selectApprovalMethod(m)}
                        className={cn(
                          'flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium capitalize transition-colors',
                          approvalMethod === m
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  {errors.approval_method && <p className="text-xs text-red-500">{errors.approval_method.message}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="approval_date">
                    Date of {approvalMethod ?? 'email/phone call'} {feeType === 'fixed' && <span className="text-red-500">*</span>}
                  </Label>
                  <Input id="approval_date" type="date" {...register('approval_date')} />
                  {errors.approval_date && <p className="text-xs text-red-500">{errors.approval_date.message}</p>}
                </div>
              </div>
            </div>
        </CardContent>
      </Card>

      {/* Staff assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Assign Staff</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select everyone who will work on this task. Multiple people can be assigned.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedRoles.map(([roleKey, group]) => {
            const memberIds = group.members.map(s => s.id)
            const allSelected = memberIds.every(id => selectedStaff.includes(id))
            const someSelected = memberIds.some(id => selectedStaff.includes(id))
            return (
              <div key={roleKey}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{group.label}</p>
                  <button
                    type="button"
                    onClick={() => toggleRole(memberIds)}
                    className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2"
                  >
                    {allSelected ? 'Deselect All' : someSelected ? 'Select All' : 'Select All'}
                  </button>
                </div>
                <div className="space-y-1">
                  {group.members.map(s => {
                    const checked = selectedStaff.includes(s.id)
                    return (
                      <label key={s.id} className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                        checked ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                      )}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStaff(s.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-900">{s.full_name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {staff.length === 0 && (
            <p className="text-sm text-slate-400">No active staff found. Add staff members first.</p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitting ? 'Saving…' : mode === 'create' ? 'Create Task' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  )
}
