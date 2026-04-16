'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/formatters'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { JOB_TYPE_OPTIONS } from '@/lib/constants/job-types'
import { NewClientModal } from '@/components/clients/new-client-modal'
import type { Client } from '@/types/database'

interface LineItem {
  key: string
  id?: string
  description: string
  quantity: string
  unit_price: string
}

interface Project { id: string; job_number: string; title: string; client_id: string | null }

interface GlobalQuoteFormProps {
  projects: Project[]
  clients:  Client[]
  /** Provided when editing an existing quote */
  quote?: {
    id: string
    quote_number: string
    project_id:   string | null
    client_id:    string | null
    contact_name: string | null
    contact_phone: string | null
    contact_email: string | null
    site_address: string | null
    suburb:       string | null
    lot_number:   string | null
    plan_number:  string | null
    job_type:     string | null
    notes:        string | null
    valid_until:  string | null
    items: { id: string; description: string; quantity: number; unit_price: number; sort_order: number }[]
  }
  /** Pre-selected job when coming from a project's Quotes tab */
  initialProjectId?: string
}

function makeKey() { return Math.random().toString(36).slice(2) }
function emptyItem(): LineItem { return { key: makeKey(), description: '', quantity: '1', unit_price: '' } }

export function GlobalQuoteForm({ projects, clients: initialClients, quote, initialProjectId }: GlobalQuoteFormProps) {
  const router  = useRouter()
  const isEdit  = !!quote

  const [clientsList, setClientsList] = useState<Client[]>(initialClients as Client[])

  function handleClientCreated(newClient: Client) {
    setClientsList(prev => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)))
    setClientId(newClient.id)
  }

  // ── Form state ────────────────────────────────────────────────────────────
  const [projectId,    setProjectId]    = useState(quote?.project_id   ?? initialProjectId ?? '')
  const [clientId,     setClientId]     = useState(quote?.client_id    ?? '')
  const [contactName,  setContactName]  = useState(quote?.contact_name  ?? '')
  const [contactPhone, setContactPhone] = useState(quote?.contact_phone ?? '')
  const [contactEmail, setContactEmail] = useState(quote?.contact_email ?? '')
  const [siteAddress,  setSiteAddress]  = useState(quote?.site_address  ?? '')
  const [suburb,       setSuburb]       = useState(quote?.suburb        ?? '')
  const [lotNumber,    setLotNumber]    = useState(quote?.lot_number    ?? '')
  const [planNumber,   setPlanNumber]   = useState(quote?.plan_number   ?? '')
  const [jobType,      setJobType]      = useState(quote?.job_type      ?? 'survey')
  const [notes,        setNotes]        = useState(quote?.notes         ?? '')
  const [validUntil,   setValidUntil]   = useState(quote?.valid_until   ?? '')

  const [items, setItems] = useState<LineItem[]>(
    quote?.items.length
      ? quote.items
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(i => ({ key: makeKey(), id: i.id, description: i.description, quantity: String(i.quantity), unit_price: String(i.unit_price) }))
      : [emptyItem()]
  )

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // ── Auto-fill from related job ────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    // Auto-fill client from the linked project
    if (project.client_id && !clientId) {
      setClientId(project.client_id)
    }
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fill contact from selected client ────────────────────────────────
  useEffect(() => {
    if (!clientId) return
    const client = clientsList.find(c => c.id === clientId)
    if (!client) return
    if (!contactName)                         setContactName(client.name)
    if (!contactPhone && client.phone)        setContactPhone(client.phone)
    if (!contactEmail && client.email)        setContactEmail(client.email)
    if (!siteAddress && client.address_line1) setSiteAddress(client.address_line1)
    if (!suburb && client.suburb)             setSuburb(client.suburb)
  }, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Totals ────────────────────────────────────────────────────────────────
  function lineAmount(item: LineItem): number {
    return Math.round((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) * 100) / 100
  }
  const subtotal = items.reduce((s, i) => s + lineAmount(i), 0)
  const gst      = Math.round(subtotal * 0.1 * 100) / 100
  const total    = Math.round((subtotal + gst) * 100) / 100

  // ── Item helpers ──────────────────────────────────────────────────────────
  const updateItem = useCallback((key: string, field: keyof LineItem, value: string) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i))
  }, [])
  const addItem    = () => setItems(prev => [...prev, emptyItem()])
  const removeItem = (key: string) => setItems(prev => prev.length > 1 ? prev.filter(i => i.key !== key) : prev)

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validItems = items.filter(i => i.description.trim())
    if (validItems.length === 0) { setError('Add at least one line item.'); return }

    const badPrice = validItems.find(i => isNaN(parseFloat(i.unit_price)) || parseFloat(i.unit_price) < 0)
    if (badPrice) { setError('All line items need a valid unit price.'); return }

    setSubmitting(true)
    const db = createClient() as any

    const quotePayload = {
      project_id:    projectId  || null,
      client_id:     clientId   || null,
      contact_name:  contactName.trim()  || null,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
      site_address:  siteAddress.trim()  || null,
      suburb:        suburb.trim()       || null,
      lot_number:    lotNumber.trim()    || null,
      plan_number:   planNumber.trim()   || null,
      job_type:      jobType || null,
      notes:         notes.trim()        || null,
      valid_until:   validUntil          || null,
      subtotal,
      gst_amount: gst,
      total,
    }

    let quoteId: string

    if (isEdit) {
      const { error: qErr } = await db.from('quotes').update(quotePayload).eq('id', quote!.id)
      if (qErr) { setError('Failed to update quote.'); setSubmitting(false); return }
      await db.from('quote_items').delete().eq('quote_id', quote!.id)
      quoteId = quote!.id
    } else {
      // Generate quote number via RPC
      const { data: qNum, error: rpcErr } = await db.rpc('generate_quote_number')
      if (rpcErr || !qNum) { setError('Failed to generate quote number.'); setSubmitting(false); return }

      const { data: newQuote, error: qErr } = await db
        .from('quotes')
        .insert({ ...quotePayload, quote_number: qNum, status: 'draft' })
        .select()
        .single()
      if (qErr || !newQuote) { setError('Failed to create quote.'); setSubmitting(false); return }
      quoteId = newQuote.id
    }

    // Insert line items
    const itemInserts = validItems.map((item, idx) => ({
      quote_id:    quoteId,
      description: item.description.trim(),
      quantity:    parseFloat(item.quantity)   || 1,
      unit_price:  parseFloat(item.unit_price) || 0,
      sort_order:  idx,
    }))
    const { error: iErr } = await db.from('quote_items').insert(itemInserts)
    if (iErr) { setError('Quote saved but line items failed.'); setSubmitting(false); return }

    router.push(`/quotes/${quoteId}`)
    router.refresh()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const selectedClient = clientsList.find(c => c.id === clientId)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Quote Details */}
      <Card>
        <CardHeader><CardTitle>Quote Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="related_job">Related Job (optional)</Label>
            <select
              id="related_job"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— No job linked —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.job_number} — {p.title}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400">Linking a job auto-fills client details.</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="job_type">Job Type</Label>
            <select
              id="job_type"
              value={jobType}
              onChange={e => setJobType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {JOB_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Client & Contact */}
      <Card>
        <CardHeader><CardTitle>Client &amp; Contact</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="client_id">Client</Label>
            <div className="flex gap-2 items-start">
              <select
                id="client_id"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— No client —</option>
                {clientsList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company_name ? `${c.company_name} (${c.name})` : c.name}
                  </option>
                ))}
              </select>
              <NewClientModal onClientCreated={handleClientCreated} />
            </div>
            {selectedClient && (
              <div className="mt-1 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 space-y-0.5">
                {selectedClient.company_name && <p className="font-medium text-slate-800">{selectedClient.company_name}</p>}
                {selectedClient.email && <p>✉ {selectedClient.email}</p>}
              </div>
            )}
          </div>

          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="contact_name">Contact Name</Label>
            <Input id="contact_name" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. John Smith" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact_phone">Phone</Label>
            <Input id="contact_phone" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="e.g. 0412 345 678" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact_email">Email</Label>
            <Input id="contact_email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="e.g. john@email.com" />
          </div>
        </CardContent>
      </Card>

      {/* Site Details */}
      <Card>
        <CardHeader><CardTitle>Site Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="site_address">Site Address</Label>
            <Input id="site_address" value={siteAddress} onChange={e => setSiteAddress(e.target.value)} placeholder="Street address" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="suburb">Suburb</Label>
            <Input id="suburb" value={suburb} onChange={e => setSuburb(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lot_number">Lot Number</Label>
            <Input id="lot_number" value={lotNumber} onChange={e => setLotNumber(e.target.value)} placeholder="e.g. 5" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan_number">Plan Number</Label>
            <Input id="plan_number" value={planNumber} onChange={e => setPlanNumber(e.target.value)} placeholder="e.g. DP123456" />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader><CardTitle>Scope of Work</CardTitle></CardHeader>
        <CardContent>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_72px_120px_100px_36px] gap-2 mb-2 px-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Description</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Qty</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Unit Price</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Amount</p>
            <span />
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.key} className="grid grid-cols-[1fr_72px_120px_100px_36px] gap-2 items-center">
                <Input
                  value={item.description}
                  onChange={e => updateItem(item.key, 'description', e.target.value)}
                  placeholder={`Item ${idx + 1}`}
                  className="h-8 text-sm"
                />
                <Input
                  type="number" min="0" step="0.01"
                  value={item.quantity}
                  onChange={e => updateItem(item.key, 'quantity', e.target.value)}
                  className="h-8 text-sm text-right"
                />
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <Input
                    type="number" min="0" step="0.01"
                    value={item.unit_price}
                    onChange={e => updateItem(item.key, 'unit_price', e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-sm pl-5 text-right"
                  />
                </div>
                <p className="text-sm text-right font-medium text-slate-700 tabular-nums">
                  {lineAmount(item) > 0 ? formatCurrency(lineAmount(item)) : <span className="text-slate-300">—</span>}
                </p>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  disabled={items.length === 1}
                  className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addItem} className="mt-4">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Line
          </Button>

          {/* Totals */}
          <div className="mt-6 border-t border-slate-200 pt-4 space-y-1.5">
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-800 w-28 text-right tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-slate-500">GST (10%)</span>
              <span className="font-medium text-slate-800 w-28 text-right tabular-nums">{formatCurrency(gst)}</span>
            </div>
            <div className="flex justify-end gap-8 text-sm border-t border-slate-200 pt-1.5">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="font-bold text-slate-900 w-28 text-right tabular-nums text-base">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes & Options */}
      <Card>
        <CardHeader><CardTitle>Notes &amp; Options</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="valid_until">Valid Until</Label>
            <Input id="valid_until" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="max-w-[180px]" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Quote valid for 30 days. Prices exclude disbursements unless noted."
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitting
            ? (isEdit ? 'Saving…' : 'Creating…')
            : (isEdit ? 'Save Changes' : 'Create Quote')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  )
}
