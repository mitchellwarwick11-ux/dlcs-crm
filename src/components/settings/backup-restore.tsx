'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Download, Upload, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'

// ─── Export ────────────────────────────────────────────────────────────────

export function ExportBackupButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    const db = createClient() as any

    const [
      { data: clients },
      { data: projects },
      { data: projectContacts },
      { data: projectStaffRates },
      { data: tasks },
      { data: taskAssignments },
      { data: quotes },
      { data: quoteItems },
      { data: invoices },
      { data: invoiceItems },
      { data: timeEntries },
      { data: documents },
      { data: purchaseOrders },
    ] = await Promise.all([
      db.from('clients').select('*'),
      db.from('projects').select('*'),
      db.from('project_contacts').select('*'),
      db.from('project_staff_rates').select('*'),
      db.from('project_tasks').select('*'),
      db.from('task_assignments').select('*'),
      db.from('quotes').select('*'),
      db.from('quote_items').select('*'),
      db.from('invoices').select('*'),
      db.from('invoice_items').select('*'),
      db.from('time_entries').select('*'),
      db.from('documents').select('*'),
      db.from('purchase_orders').select('*'),
    ])

    const backup = {
      version: 2,
      exported_at: new Date().toISOString(),
      clients:            clients            ?? [],
      projects:           projects           ?? [],
      project_contacts:   projectContacts    ?? [],
      project_staff_rates: projectStaffRates ?? [],
      project_tasks:      tasks              ?? [],
      task_assignments:   taskAssignments    ?? [],
      quotes:             quotes             ?? [],
      quote_items:        quoteItems         ?? [],
      invoices:           invoices           ?? [],
      invoice_items:      invoiceItems       ?? [],
      time_entries:       timeEntries        ?? [],
      documents:          documents          ?? [],
      purchase_orders:    purchaseOrders     ?? [],
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `dlcs-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setLoading(false)
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      {loading
        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting…</>
        : <><Download className="h-4 w-4 mr-2" />Export Backup</>}
    </Button>
  )
}

// ─── Restore ───────────────────────────────────────────────────────────────

export function RestoreBackupButton() {
  const router   = useRouter()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [open, setOpen]       = useState(false)
  const [file, setFile]       = useState<File | null>(null)
  const [status, setStatus]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [detail, setDetail]   = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
  }

  async function handleRestore() {
    if (!file) return
    setStatus('loading')
    setErrorMsg('')

    let backup: any
    try {
      const text = await file.text()
      backup = JSON.parse(text)
    } catch {
      setStatus('error')
      setErrorMsg('Could not read the file. Make sure it is a valid DLCS backup JSON.')
      return
    }

    if (!backup.version || !backup.clients) {
      setStatus('error')
      setErrorMsg('This does not look like a valid DLCS backup file.')
      return
    }

    const db = createClient() as any

    // ── 1. Clear all existing data ──────────────────────────────────────
    setDetail('Clearing existing data…')

    const { data: taskRows }    = await db.from('project_tasks').select('id')
    const { data: invoiceRows } = await db.from('invoices').select('id')
    const { data: quoteRows }   = await db.from('quotes').select('id')
    const taskIds    = (taskRows    ?? []).map((r: any) => r.id)
    const invoiceIds = (invoiceRows ?? []).map((r: any) => r.id)
    const quoteIds   = (quoteRows   ?? []).map((r: any) => r.id)

    await db.from('time_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (taskIds.length)    await db.from('task_assignments').delete().in('task_id', taskIds)
    await db.from('project_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (invoiceIds.length) await db.from('invoice_items').delete().in('invoice_id', invoiceIds)
    await db.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (quoteIds.length)   await db.from('quote_items').delete().in('quote_id', quoteIds)
    await db.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await db.from('purchase_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await db.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await db.from('project_contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await db.from('project_staff_rates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await db.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await db.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Helper: batch insert in chunks of 50
    async function insertBatch(table: string, rows: any[], label: string) {
      if (!rows?.length) return
      setDetail(`Restoring ${label} (${rows.length})…`)
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50)
        const { error } = await db.from(table).insert(chunk)
        if (error) throw new Error(`${label}: ${error.message}`)
      }
    }

    try {
      // ── 2. Re-insert in dependency order ──────────────────────────────
      await insertBatch('clients',             backup.clients,             'clients')
      await insertBatch('projects',            backup.projects,            'jobs')
      await insertBatch('project_contacts',    backup.project_contacts,    'project contacts')
      await insertBatch('project_staff_rates', backup.project_staff_rates, 'project staff rates')
      await insertBatch('project_tasks',       backup.project_tasks,       'tasks')
      await insertBatch('task_assignments',    backup.task_assignments,    'task assignments')
      await insertBatch('quotes',              backup.quotes,              'quotes')
      await insertBatch('quote_items',         backup.quote_items,         'quote items')
      await insertBatch('invoices',            backup.invoices,            'invoices')

      // Insert time_entries first with invoice_item_id nulled (circular ref)
      setDetail('Restoring time entries…')
      const timeRows = (backup.time_entries ?? []).map((r: any) => ({
        ...r, invoice_item_id: null,
      }))
      await insertBatch('time_entries', timeRows, 'time entries')

      // Insert invoice_items (reference time_entries via time_entry_id)
      await insertBatch('invoice_items', backup.invoice_items, 'invoice items')

      // Patch time_entries.invoice_item_id back in
      const invoicedEntries = (backup.time_entries ?? []).filter((r: any) => r.invoice_item_id)
      if (invoicedEntries.length) {
        setDetail('Linking invoiced time entries…')
        for (const entry of invoicedEntries) {
          await db.from('time_entries')
            .update({ invoice_item_id: entry.invoice_item_id })
            .eq('id', entry.id)
        }
      }

      await insertBatch('purchase_orders', backup.purchase_orders ?? [], 'purchase orders')
      await insertBatch('documents',       backup.documents       ?? [], 'documents')

      setStatus('done')
      setOpen(false)
      setTimeout(() => { setStatus('idle'); setFile(null); router.refresh() }, 1500)

    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err.message ?? 'Restore failed.')
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Restore Backup
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">

            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Restore from backup</h2>
                <p className="text-sm text-slate-500 mt-1">
                  This will <strong>delete all current data</strong> and replace it with the contents of your backup file.
                  Staff profiles and settings will not be affected.
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-600 mb-2">Select backup file</label>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
              {file && (
                <p className="text-xs text-slate-400 mt-1.5">{file.name}</p>
              )}
            </div>

            {status === 'loading' && (
              <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                {detail}
              </p>
            )}

            {status === 'done' && (
              <p className="text-sm text-green-600 mb-4 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" />
                Restore complete.
              </p>
            )}

            {status === 'error' && (
              <p className="text-sm text-red-600 mb-4">{errorMsg}</p>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => { setOpen(false); setFile(null); setStatus('idle') }}
                disabled={status === 'loading'}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRestore}
                disabled={!file || status === 'loading'}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {status === 'loading'
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Restoring…</>
                  : 'Restore'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
