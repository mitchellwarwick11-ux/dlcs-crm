'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, GripVertical } from 'lucide-react'
import type { FeeProposalTemplate } from '@/types/database'

interface TemplateFormProps {
  /** Provided when editing an existing template */
  template?: FeeProposalTemplate
}

function makeId() { return Math.random().toString(36).slice(2) }

interface ListItem { key: string; value: string }

function toListItems(arr: string[]): ListItem[] {
  return arr.map(v => ({ key: makeId(), value: v }))
}

export function TemplateForm({ template }: TemplateFormProps) {
  const router  = useRouter()
  const isEdit  = !!template

  const [label, setLabel]   = useState(template?.label ?? '')
  const [scopeItems, setScopeItems]   = useState<ListItem[]>(
    toListItems(template?.scope_items ?? [])
  )
  const [noteItems, setNoteItems]     = useState<ListItem[]>(
    toListItems(template?.please_note_items ?? [])
  )
  const [validUntilDays, setValidUntilDays] = useState(
    String(template?.valid_until_days ?? 60)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // ── List helpers ──────────────────────────────────────────────
  function addItem(setter: React.Dispatch<React.SetStateAction<ListItem[]>>) {
    setter(prev => [...prev, { key: makeId(), value: '' }])
  }

  function updateItem(
    setter: React.Dispatch<React.SetStateAction<ListItem[]>>,
    key: string,
    value: string
  ) {
    setter(prev => prev.map(i => i.key === key ? { ...i, value } : i))
  }

  function removeItem(
    setter: React.Dispatch<React.SetStateAction<ListItem[]>>,
    key: string
  ) {
    setter(prev => prev.filter(i => i.key !== key))
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) { setError('Template name is required.'); return }

    setSaving(true)
    setError(null)

    const supabase = createClient()
    const db = supabase as any

    const payload = {
      label:             label.trim(),
      scope_items:       scopeItems.map(i => i.value).filter(Boolean),
      please_note_items: noteItems.map(i => i.value).filter(Boolean),
      valid_until_days:  parseInt(validUntilDays) || 60,
    }

    if (isEdit) {
      const { error: err } = await db
        .from('fee_proposal_templates')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', template!.id)
      if (err) { setError('Failed to save template.'); setSaving(false); return }
    } else {
      const { data: existing } = await db
        .from('fee_proposal_templates')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()
      const nextOrder = existing ? (existing.sort_order + 1) : 0
      const { error: err } = await db
        .from('fee_proposal_templates')
        .insert({ ...payload, sort_order: nextOrder, is_active: true })
      if (err) { setError('Failed to create template.'); setSaving(false); return }
    }

    router.push('/quotes/templates')
    router.refresh()
  }

  // ── Render list editor ────────────────────────────────────────
  function ListEditor({
    items,
    setter,
    placeholder,
  }: {
    items: ListItem[]
    setter: React.Dispatch<React.SetStateAction<ListItem[]>>
    placeholder: string
  }) {
    return (
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.key} className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
            <span className="text-xs text-slate-400 w-5 text-right shrink-0">{idx + 1}.</span>
            <Input
              value={item.value}
              onChange={e => updateItem(setter, item.key, e.target.value)}
              placeholder={placeholder}
              className="flex-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeItem(setter, item.key)}
              className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addItem(setter)}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add item
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">

      {/* Template name */}
      <div className="space-y-1">
        <Label htmlFor="label">Template Name</Label>
        <Input
          id="label"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Contour & Detail Survey"
          className="text-base"
        />
        <p className="text-xs text-slate-400">This becomes the Task name when a quote is accepted.</p>
      </div>

      {/* Valid until */}
      <div className="space-y-1 max-w-xs">
        <Label htmlFor="validUntilDays">Default Valid For (days)</Label>
        <Input
          id="validUntilDays"
          type="number"
          min="1"
          value={validUntilDays}
          onChange={e => setValidUntilDays(e.target.value)}
          placeholder="60"
        />
        <p className="text-xs text-slate-400">Auto-sets the Valid Until date when this template is selected in a fee proposal.</p>
      </div>

      {/* Scope items */}
      <div className="space-y-2">
        <div>
          <Label>Scope Items</Label>
          <p className="text-xs text-slate-400 mt-0.5">The checklist shown on the fee proposal — client can see what's included.</p>
        </div>
        <ListEditor
          items={scopeItems}
          setter={setScopeItems}
          placeholder="e.g. All levels and contours shown relative to AHD."
        />
      </div>

      {/* Please Note items */}
      <div className="space-y-2">
        <div>
          <Label>Please Note Items</Label>
          <p className="text-xs text-slate-400 mt-0.5">Conditions and disclaimers shown at the bottom of the fee proposal.</p>
        </div>
        <ListEditor
          items={noteItems}
          setter={setNoteItems}
          placeholder="e.g. The above fee does not include council fees."
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Template'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/quotes/templates')}
        >
          Cancel
        </Button>
      </div>

    </form>
  )
}
