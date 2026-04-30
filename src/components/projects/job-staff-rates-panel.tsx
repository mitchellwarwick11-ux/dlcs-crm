'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/formatters'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface RoleRate {
  role_key: string
  label: string
  hourly_rate: number
}

interface RoleOverride {
  id: string
  role_key: string
  hourly_rate: number
}

interface Props {
  projectId: string
  roleRates: RoleRate[]
  overrides: RoleOverride[]
}

export function JobStaffRatesPanel({ projectId, roleRates, overrides }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const o of overrides) m[o.role_key] = String(o.hourly_rate)
    return m
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save(roleKey: string) {
    const raw = drafts[roleKey]?.trim()
    const rate = parseFloat(raw ?? '')
    if (!raw || isNaN(rate) || rate < 0) {
      setError('Enter a valid rate (e.g. 195.00)')
      return
    }
    setSaving(roleKey)
    setError(null)
    const db = createClient() as any
    const { error: err } = await db
      .from('project_role_rates')
      .upsert(
        { project_id: projectId, role_key: roleKey, hourly_rate: rate },
        { onConflict: 'project_id,role_key' }
      )
    setSaving(null)
    if (err) { setError(`Save failed: ${err.message}`); return }
    startTransition(() => router.refresh())
  }

  async function clear(roleKey: string) {
    setSaving(roleKey)
    setError(null)
    const db = createClient() as any
    const { error: err } = await db
      .from('project_role_rates')
      .delete()
      .eq('project_id', projectId)
      .eq('role_key', roleKey)
    setSaving(null)
    if (err) { setError(`Remove failed: ${err.message}`); return }
    setDrafts(prev => { const n = { ...prev }; delete n[roleKey]; return n })
    startTransition(() => router.refresh())
  }

  const hasAnyOverride = overrides.length > 0

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Set a job-specific rate for any role. These override the standard Role Hourly Rates from Settings when staff in that role log time to this job.
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
              <th className="text-left font-medium text-slate-500 pb-2 pr-4">Role</th>
              <th className="text-right font-medium text-slate-500 pb-2 pr-6">Standard Rate</th>
              <th className="text-left font-medium text-slate-500 pb-2">Job Rate Override</th>
            </tr>
          </thead>
          <tbody>
            {roleRates.map(r => {
              const override = overrides.find(o => o.role_key === r.role_key)
              const draft = drafts[r.role_key] ?? ''
              const hasOverride = override !== undefined
              const isSaving = saving === r.role_key

              return (
                <tr key={r.role_key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-slate-900">{r.label}</td>
                  <td className="py-2.5 pr-6 text-right text-slate-600 tabular-nums">
                    {formatCurrency(r.hourly_rate)}<span className="text-slate-400">/hr</span>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={Number(r.hourly_rate).toFixed(2)}
                          value={draft}
                          onChange={e => setDrafts(p => ({ ...p, [r.role_key]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(r.role_key) } }}
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
                          onClick={() => save(r.role_key)}
                        >
                          {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                      )}
                      {hasOverride && (
                        <button
                          onClick={() => clear(r.role_key)}
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
