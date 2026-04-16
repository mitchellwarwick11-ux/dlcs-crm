'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'

const CONFIRM_PHRASE = 'DELETE ALL'

export function ClearAllDataButton() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [typed, setTyped]     = useState('')
  const [status, setStatus]   = useState<'idle' | 'loading' | 'done'>('idle')
  const [detail, setDetail]   = useState('')

  async function handleDelete() {
    setStatus('loading')
    const db = createClient() as any

    const steps: [string, () => Promise<any>][] = [
      ['time entries',       () => db.from('time_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
      ['task assignments',   () => db.from('task_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
      ['tasks',              () => db.from('project_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
      ['invoice items',      () => db.from('invoice_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
      ['invoices',           () => db.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
      ['quote items',        () => db.from('quote_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
      ['quotes',             () => db.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
      ['documents',          () => db.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
      ['project contacts',   () => db.from('project_contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
      ['project staff rates',() => db.from('project_staff_rates').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
      ['jobs',               () => db.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
      ['clients',            () => db.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
    ]

    for (const [label, fn] of steps) {
      setDetail(`Deleting ${label}…`)
      await fn()
    }

    setStatus('done')
    setOpen(false)
    setTimeout(() => { setStatus('idle'); setTyped(''); router.refresh() }, 2000)
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle className="h-4 w-4" />
        All data cleared.
      </div>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Clear All Data
      </Button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">

            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Clear all data</h2>
                <p className="text-sm text-slate-500 mt-1">
                  This will permanently delete <strong>all clients, jobs, tasks, quotes, invoices, and time entries</strong>.
                  Staff profiles and settings will not be affected.
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  This cannot be undone.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Type <span className="font-mono font-bold text-red-600">{CONFIRM_PHRASE}</span> to confirm
              </label>
              <input
                autoFocus
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                value={typed}
                onChange={e => setTyped(e.target.value.toUpperCase())}
                placeholder={CONFIRM_PHRASE}
                disabled={status === 'loading'}
              />
            </div>

            {status === 'loading' && (
              <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {detail}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => { setOpen(false); setTyped('') }}
                disabled={status === 'loading'}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={typed !== CONFIRM_PHRASE || status === 'loading'}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {status === 'loading'
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</>
                  : 'Yes, delete everything'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
