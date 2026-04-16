'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/formatters'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface StaffMember {
  id: string
  full_name: string
  role: string
  default_hourly_rate: number
}

interface RateOverride {
  id: string
  staff_id: string
  hourly_rate: number
}

interface Props {
  projectId: string
  staff: StaffMember[]
  overrides: RateOverride[]
}

export function JobStaffRatesPanel({ projectId, staff, overrides }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  // Local draft values per staff_id
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const o of overrides) m[o.staff_id] = String(o.hourly_rate)
    return m
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save(staffId: string) {
    const raw = drafts[staffId]?.trim()
    const rate = parseFloat(raw ?? '')
    if (!raw || isNaN(rate) || rate < 0) {
      setError('Enter a valid rate (e.g. 195.00)')
      return
    }
    setSaving(staffId)
    setError(null)
    const db = createClient() as any
    const { error: err } = await db
      .from('project_staff_rates')
      .upsert(
        { project_id: projectId, staff_id: staffId, hourly_rate: rate },
        { onConflict: 'project_id,staff_id' }
      )
    setSaving(null)
    if (err) { setError(`Save failed: ${err.message}`); return }
    startTransition(() => router.refresh())
  }

  async function clear(staffId: string) {
    setSaving(staffId)
    setError(null)
    const db = createClient() as any
    const { error: err } = await db
      .from('project_staff_rates')
      .delete()
      .eq('project_id', projectId)
      .eq('staff_id', staffId)
    setSaving(null)
    if (err) { setError(`Remove failed: ${err.message}`); return }
    setDrafts(prev => { const n = { ...prev }; delete n[staffId]; return n })
    startTransition(() => router.refresh())
  }

  const hasAnyOverride = overrides.length > 0

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Set a job-specific rate for any staff member. These override the standard rates in Settings when logging time to this job.
        {hasAnyOverride && (
          <span className="ml-1 text-amber-600 font-medium">
            {overrides.length} override{overrides.length !== 1 ? 's' : ''} active.
          </span>
        )}
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left font-medium text-slate-500 pb-2 pr-4">Staff Member</th>
              <th className="text-left font-medium text-slate-500 pb-2 pr-4">Role</th>
              <th className="text-right font-medium text-slate-500 pb-2 pr-6">Standard Rate</th>
              <th className="text-left font-medium text-slate-500 pb-2">Job Rate Override</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => {
              const override = overrides.find(o => o.staff_id === s.id)
              const draft = drafts[s.id] ?? ''
              const hasOverride = override !== undefined
              const isSaving = saving === s.id

              return (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-slate-900">{s.full_name}</td>
                  <td className="py-2.5 pr-4 text-slate-500 capitalize text-xs">
                    {s.role?.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2.5 pr-6 text-right text-slate-600 tabular-nums">
                    {formatCurrency(s.default_hourly_rate)}<span className="text-slate-400">/hr</span>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={s.default_hourly_rate.toFixed(2)}
                          value={draft}
                          onChange={e => setDrafts(p => ({ ...p, [s.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(s.id) } }}
                          disabled={isSaving}
                          className={`w-28 pl-6 text-sm h-8 ${hasOverride ? 'border-amber-400 bg-amber-50 font-medium' : ''}`}
                        />
                      </div>
                      {draft !== '' && draft !== String(override?.hourly_rate ?? '') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          disabled={isSaving}
                          onClick={() => save(s.id)}
                        >
                          {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                      )}
                      {hasOverride && (
                        <button
                          onClick={() => clear(s.id)}
                          disabled={isSaving}
                          title="Remove override — revert to standard rate"
                          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {hasOverride && (
                        <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
                          override active
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
