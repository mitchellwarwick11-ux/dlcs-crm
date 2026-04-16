'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import type { RoleRate } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

const ACCESS_LEVELS = [
  { value: 'staff',           label: 'Staff — limited access' },
  { value: 'project_manager', label: 'Project Manager — mid-level access' },
  { value: 'admin',           label: 'Administrator — full access' },
]

const staffSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  role_key: z.string().min(1, 'Role is required'),
  hourly_rate: z.number().min(0, 'Rate must be 0 or more'),
  is_active: z.boolean(),
  access_level: z.enum(['staff', 'project_manager', 'admin']),
})

type StaffFormValues = z.infer<typeof staffSchema>

interface StaffFormProps {
  mode: 'create' | 'edit'
  staffId?: string
  roleRates: RoleRate[]
  initialValues?: Partial<StaffFormValues>
}

export function StaffForm({ mode, staffId, roleRates, initialValues }: StaffFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeRoles = roleRates.filter(r => r.is_active).sort((a, b) => a.sort_order - b.sort_order)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      full_name: '',
      email: '',
      role_key: '',
      hourly_rate: 0,
      is_active: true,
      access_level: 'staff',
      ...initialValues,
    },
  })

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const key = e.target.value
    setValue('role_key', key)
    // Auto-fill rate from role default
    const roleRate = roleRates.find(r => r.role_key === key)
    if (roleRate) setValue('hourly_rate', roleRate.hourly_rate)
  }

  async function onSubmit(values: StaffFormValues) {
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const db = supabase as any

    const payload = {
      full_name: values.full_name.trim(),
      email: values.email.trim().toLowerCase(),
      role: values.role_key,
      default_hourly_rate: values.hourly_rate,
      is_active: values.is_active,
      access_level: values.access_level,
    }

    if (mode === 'create') {
      const { data, error: err } = await db.from('staff_profiles').insert(payload).select().single()
      if (err || !data) {
        setError(`Failed to create staff member: ${err?.message ?? 'Unknown error'}`)
        setSubmitting(false)
        return
      }
      router.push(`/staff/${data.id}`)
    } else {
      const { error: err } = await db.from('staff_profiles').update(payload).eq('id', staffId)
      if (err) {
        setError('Failed to update staff member. Please try again.')
        setSubmitting(false)
        return
      }
      router.push(`/staff/${staffId}`)
    }

    router.refresh()
  }

  const selectedRoleKey = watch('role_key')
  const selectedRole = roleRates.find(r => r.role_key === selectedRoleKey)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      <Card>
        <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="full_name">Full Name <span className="text-red-500">*</span></Label>
            <Input id="full_name" {...register('full_name')} placeholder="e.g. Jane Smith" />
            {errors.full_name && <p className="text-xs text-red-500">{errors.full_name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
            <Input id="email" {...register('email')} type="email" placeholder="e.g. jane@dlcs.com.au" />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role & Rate</CardTitle>
          <p className="text-sm text-muted-foreground">
            The hourly rate auto-fills from the role default. You can override it per person if needed.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="role_key">Role <span className="text-red-500">*</span></Label>
            <select
              id="role_key"
              {...register('role_key')}
              onChange={handleRoleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select role —</option>
              {activeRoles.map(r => (
                <option key={r.role_key} value={r.role_key}>{r.label}</option>
              ))}
            </select>
            {errors.role_key && <p className="text-xs text-red-500">{errors.role_key.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="hourly_rate">
              Hourly Rate
              {selectedRole && (
                <span className="ml-2 text-xs text-slate-400 font-normal">
                  (default: ${selectedRole.hourly_rate.toFixed(2)}/hr)
                </span>
              )}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <Input
                id="hourly_rate"
                {...register('hourly_rate', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                className="pl-6"
              />
            </div>
            {errors.hourly_rate && <p className="text-xs text-red-500">{errors.hourly_rate.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="access_level">Access Level</Label>
            <select
              id="access_level"
              {...register('access_level')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ACCESS_LEVELS.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {mode === 'edit' && (
            <div className="flex items-center gap-3">
              <input id="is_active" type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-slate-300" />
              <Label htmlFor="is_active" className="font-normal cursor-pointer">Active staff member</Label>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitting ? 'Saving…' : mode === 'create' ? 'Add Staff Member' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  )
}
