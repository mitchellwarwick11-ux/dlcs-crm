'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pencil, X, Trash2, ArrowUp, ArrowDown, Star } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import type { RoleRate } from '@/types/database'

interface Props {
  roleRates: RoleRate[]
  /** role_keys ticked on this proposal */
  selected: string[]
  onSelectedChange: (keys: string[]) => void
  /** Called when the rate list itself is mutated (reorder / remove / default toggle). */
  onRoleRatesChange: (rates: RoleRate[]) => void
}

export function RoleRatesInlineEditor({
  roleRates, selected, onSelectedChange, onRoleRatesChange,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const db = createClient() as any

  function toggleSelected(key: string) {
    onSelectedChange(
      selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]
    )
  }

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= roleRates.length) return
    const reordered = [...roleRates]
    ;[reordered[idx], reordered[j]] = [reordered[j], reordered[idx]]
    const renumbered = reordered.map((r, i) => ({ ...r, sort_order: i + 1 }))
    onRoleRatesChange(renumbered)
    setError(null)
    startTransition(async () => {
      const a = renumbered[idx]
      const b = renumbered[j]
      const [ra, rb] = await Promise.all([
        db.from('role_rates').update({ sort_order: a.sort_order }).eq('id', a.id),
        db.from('role_rates').update({ sort_order: b.sort_order }).eq('id', b.id),
      ])
      if (ra.error || rb.error) setError('Failed to save new order.')
    })
  }

  function deactivate(role: RoleRate) {
    setError(null)
    startTransition(async () => {
      const { error } = await db.from('role_rates').update({ is_active: false }).eq('id', role.id)
      if (error) { setError('Failed to remove rate.'); return }
      onRoleRatesChange(roleRates.filter(r => r.id !== role.id))
      onSelectedChange(selected.filter(k => k !== role.role_key))
    })
  }

  function toggleDefault(role: RoleRate) {
    const next = !role.default_checked
    onRoleRatesChange(
      roleRates.map(r => r.id === role.id ? { ...r, default_checked: next } : r)
    )
    setError(null)
    startTransition(async () => {
      const { error } = await db.from('role_rates').update({ default_checked: next }).eq('id', role.id)
      if (error) {
        setError('Failed to update default.')
        // Revert local state on failure
        onRoleRatesChange(
          roleRates.map(r => r.id === role.id ? { ...r, default_checked: !next } : r)
        )
      }
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-700">Hourly Rates</div>
          <p className="text-xs text-slate-400">Tick the roles whose standard hourly rate should appear on this proposal.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(e => !e)}
          className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
        >
          {editing ? <><X className="h-3 w-3" /> Done</> : <><Pencil className="h-3 w-3" /> Edit Rates</>}
        </button>
      </div>

      <div className="space-y-1 border border-slate-200 rounded-md p-3 bg-white">
        {roleRates.length === 0 && (
          <p className="text-xs text-slate-400">No active roles. Add role rates in Settings.</p>
        )}
        {roleRates.map((r, i) => (
          <div key={r.role_key} className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer group flex-1 min-w-0">
              <input
                type="checkbox"
                checked={selected.includes(r.role_key)}
                onChange={() => toggleSelected(r.role_key)}
                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-slate-800"
              />
              <span className="text-xs text-slate-700 leading-relaxed group-hover:text-slate-900 flex-1 truncate">{r.label}</span>
              <span className="text-xs text-slate-500 tabular-nums shrink-0">{formatCurrency(r.hourly_rate)}/hr</span>
            </label>
            {editing && (
              <div className="flex items-center gap-0.5 shrink-0 ml-1">
                <button
                  type="button"
                  onClick={() => toggleDefault(r)}
                  disabled={pending}
                  title={r.default_checked
                    ? 'Default ON — ticked by default on new proposals'
                    : 'Default OFF — click to tick by default on new proposals'}
                  className={`p-1 rounded transition-colors ${
                    r.default_checked
                      ? 'text-amber-500 hover:text-amber-600'
                      : 'text-slate-300 hover:text-amber-500'
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${r.default_checked ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={pending || i === 0}
                  title="Move up"
                  className="p-1 rounded text-slate-300 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-300"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={pending || i === roleRates.length - 1}
                  title="Move down"
                  className="p-1 rounded text-slate-300 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-300"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deactivate(r)}
                  disabled={pending}
                  title="Remove from list (kept in Settings as inactive)"
                  className="p-1 rounded text-slate-300 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <p className="text-[11px] text-slate-400 leading-snug">
          <Star className="inline h-3 w-3 -mt-px mr-0.5 text-amber-500 fill-current" />
          marks roles ticked by default on new proposals. To rename, change the price, or restore a removed role, use Settings.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
