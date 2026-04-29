'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2, AlertTriangle } from 'lucide-react'

export function DeleteJobButton({ projectId, jobNumber }: { projectId: string; jobNumber: string }) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const db = createClient() as any

    // Fetch related IDs first (Supabase JS .in() needs real arrays, not subqueries)
    const { data: taskRows }    = await db.from('project_tasks').select('id').eq('project_id', projectId)
    const { data: invoiceRows } = await db.from('invoices').select('id').eq('project_id', projectId)
    const { data: quoteRows }   = await db.from('quotes').select('id').eq('project_id', projectId)

    const taskIds    = (taskRows    ?? []).map((r: any) => r.id)
    const invoiceIds = (invoiceRows ?? []).map((r: any) => r.id)
    const quoteIds   = (quoteRows   ?? []).map((r: any) => r.id)

    // Delete in dependency order
    await db.from('time_entries').delete().eq('project_id', projectId)
    if (taskIds.length > 0)    await db.from('task_assignments').delete().in('task_id', taskIds)
    await db.from('project_tasks').delete().eq('project_id', projectId)
    if (invoiceIds.length > 0) await db.from('invoice_items').delete().in('invoice_id', invoiceIds)
    await db.from('invoices').delete().eq('project_id', projectId)
    if (quoteIds.length > 0)   await db.from('quote_items').delete().in('quote_id', quoteIds)
    await db.from('quotes').delete().eq('project_id', projectId)
    await db.from('documents').delete().eq('project_id', projectId)
    await db.from('project_contacts').delete().eq('project_id', projectId)
    await db.from('project_staff_rates').delete().eq('project_id', projectId)
    await db.from('project_role_rates').delete().eq('project_id', projectId)

    const { error: delErr } = await db.from('projects').delete().eq('id', projectId)

    if (delErr) {
      setError(delErr.message)
      setLoading(false)
      return
    }

    router.push('/projects')
    router.refresh()
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Job
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Delete job {jobNumber}?</h2>
                <p className="text-sm text-slate-500 mt-1">
                  This will permanently delete the job and all associated tasks, time entries, quotes, and invoices. This cannot be undone.
                </p>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</>
                  : 'Yes, delete job'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
