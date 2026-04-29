'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import type { GenericNote } from '@/types/database'

interface Props {
  notes: GenericNote[]
  /** Texts currently ticked on this proposal. */
  selected: string[]
  onSelectedChange: (texts: string[]) => void
  /** Called after add/delete so the parent can refresh its local list. */
  onNotesChange: (notes: GenericNote[]) => void
}

export function GenericNotesEditor({ notes, selected, onSelectedChange, onNotesChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [newText, setNewText]  = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const db = createClient() as any

  function toggle(text: string) {
    onSelectedChange(
      selected.includes(text) ? selected.filter(t => t !== text) : [...selected, text]
    )
  }

  function addNote() {
    const text = newText.trim()
    if (!text) return
    setError(null)
    startTransition(async () => {
      const nextOrder = notes.length > 0 ? Math.max(...notes.map(n => n.sort_order)) + 1 : 0
      const { data, error } = await db
        .from('generic_notes')
        .insert({ text, sort_order: nextOrder, is_active: true })
        .select('*')
        .single()
      if (error || !data) { setError('Failed to add note.'); return }
      onNotesChange([...notes, data as GenericNote])
      // Don't auto-tick — user must explicitly select to include on this proposal.
      setNewText('')
    })
  }

  function removeNote(note: GenericNote) {
    setError(null)
    startTransition(async () => {
      const { error } = await db.from('generic_notes').delete().eq('id', note.id)
      if (error) { setError('Failed to delete note.'); return }
      onNotesChange(notes.filter(n => n.id !== note.id))
      onSelectedChange(selected.filter(t => t !== note.text))
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-700">Generic Notes</div>
          <p className="text-xs text-slate-400">Tick the notes that apply to this proposal.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(e => !e)}
          className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
        >
          {editing ? <><X className="h-3 w-3" /> Done</> : <><Pencil className="h-3 w-3" /> Edit Notes</>}
        </button>
      </div>

      <div className="space-y-1 border border-slate-200 rounded-md p-3 bg-white">
        {notes.length === 0 && !editing && (
          <p className="text-xs text-slate-400">No generic notes yet. Click <em>Edit Notes</em> to add some.</p>
        )}
        {notes.map(note => (
          <div key={note.id} className="flex items-start gap-2">
            <label className="flex items-start gap-2 cursor-pointer group flex-1">
              <input
                type="checkbox"
                checked={selected.includes(note.text)}
                onChange={() => toggle(note.text)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-slate-800"
              />
              <span className="text-xs text-slate-700 leading-relaxed group-hover:text-slate-900">{note.text}</span>
            </label>
            {editing && (
              <button
                type="button"
                onClick={() => removeNote(note)}
                disabled={pending}
                className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                title="Remove note"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        {editing && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-2">
            <Input
              className="bg-white text-xs flex-1"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Add a new generic note…"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNote() } }}
            />
            <Button type="button" size="sm" onClick={addNote} disabled={pending || !newText.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
