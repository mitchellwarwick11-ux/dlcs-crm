'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, X } from 'lucide-react'
import type { ProjectRate } from './my-work-board'

interface RoleOption {
  role_key: string
  label: string
  hourly_rate: number
}

interface Props {
  taskId: string
  projectId: string
  staffId: string
  staffRole: string | null
  defaultHourlyRate: number
  feeType: string
  projectRates: ProjectRate[]
  roleRates: RoleOption[]
  defaultDescription?: string
  onLogged: (hours: number) => void
  onCancel: () => void
}

export function InlineTimeLog({
  taskId,
  projectId,
  staffId,
  staffRole,
  defaultHourlyRate,
  feeType,
  projectRates,
  roleRates,
  defaultDescription,
  onLogged,
  onCancel,
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState(defaultDescription ?? '')
  const [actingRole, setActingRole] = useState(staffRole ?? '')

  // Default rate (when acting role == staff role): use the project override prop
  const defaultRoleOverride = projectRates.find(r => r.projectId === projectId)?.hourlyRate
  const isDefaultRole = actingRole === (staffRole ?? '')
  const resolvedRate = isDefaultRole
    ? (defaultRoleOverride ?? defaultHourlyRate)
    : (roleRates.find(r => r.role_key === actingRole)?.hourly_rate ?? defaultHourlyRate)

  const hoursNum = parseFloat(hours)
  const isValid = !isNaN(hoursNum) && hoursNum > 0 && date

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    setSaving(true)
    const db = createClient() as any

    // For non-default roles, look up the project-specific override before inserting
    let rate = resolvedRate
    if (!isDefaultRole && actingRole) {
      const { data: override } = await db
        .from('project_role_rates')
        .select('hourly_rate')
        .eq('project_id', projectId)
        .eq('role_key', actingRole)
        .maybeSingle()
      if (override?.hourly_rate) rate = Number(override.hourly_rate)
    }

    const actingRoleToSave = actingRole && actingRole !== (staffRole ?? null) ? actingRole : null

    const { error } = await db.from('time_entries').insert({
      project_id: projectId,
      task_id: taskId,
      staff_id: staffId,
      date,
      hours: hoursNum,
      description: description.trim() || null,
      is_billable: feeType !== 'non_billable',
      rate_at_time: rate,
      acting_role: actingRoleToSave,
    })

    setSaving(false)

    if (!error) {
      onLogged(hoursNum)
      setHours('')
      setDescription('')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 flex-wrap">
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Date</label>
        <Input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-36 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Hours</label>
        <Input
          type="number"
          step="0.25"
          min="0.25"
          placeholder="e.g. 2.5"
          value={hours}
          onChange={e => setHours(e.target.value)}
          className="w-24 text-sm"
        />
      </div>
      {roleRates.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Acting As</label>
          <select
            value={actingRole}
            onChange={e => setActingRole(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm h-9"
          >
            {roleRates.map(r => (
              <option key={r.role_key} value={r.role_key}>
                {r.label}{staffRole === r.role_key ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1 flex-1 min-w-[160px]">
        <label className="text-xs font-medium text-slate-500">Task Description</label>
        <Input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What did you do?"
          className="text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving || !isValid}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Log
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {resolvedRate > 0 && hoursNum > 0 && (
        <p className="text-xs text-slate-400 w-full">
          ${resolvedRate}/h &rarr; ${(resolvedRate * hoursNum).toFixed(2)}
        </p>
      )}
    </form>
  )
}
