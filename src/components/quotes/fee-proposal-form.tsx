'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, Wand2 } from 'lucide-react'
import { NewClientModal } from '@/components/clients/new-client-modal'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Client, FeeProposalTemplate } from '@/types/database'

// Label with optional auto-filled indicator
function AutoLabel({ htmlFor, filled, children }: { htmlFor: string; filled: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
      {children}
      {filled && (
        <span className="inline-flex items-center gap-0.5 text-xs text-violet-500" title="Auto-filled — you can edit this">
          <Wand2 className="h-3 w-3" />
        </span>
      )}
    </label>
  )
}

interface SpecifiedItem { key: string; value: string }
function makeKey() { return Math.random().toString(36).slice(2) }

interface Project { id: string; job_number: string; title: string; client_id: string | null }

interface FeeProposalFormProps {
  clients: Client[]
  projects: Project[]
  templates: FeeProposalTemplate[]
}

function formatDateStr(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function FeeProposalForm({ clients: initialClients, projects, templates }: FeeProposalFormProps) {
  const router = useRouter()

  const firstTemplate = templates[0] ?? null

  const [clientsList, setClientsList]   = useState<Client[]>(initialClients)
  const [clientId, setClientId]         = useState('')
  const [contactName, setContactName]   = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [siteAddress, setSiteAddress]   = useState('')
  const [suburb, setSuburb]             = useState('')
  const [lotNumber, setLotNumber]       = useState('')
  const [planNumber, setPlanNumber]     = useState('')
  const [relatedJobId, setRelatedJobId] = useState('')
  const [templateId, setTemplateId]     = useState(firstTemplate?.id ?? '')
  const [taskName, setTaskName]         = useState(firstTemplate?.label ?? '')
  const [selectedItems, setSelectedItems]     = useState<string[]>(firstTemplate?.scope_items ?? [])
  const [specifiedItems, setSpecifiedItems]   = useState<SpecifiedItem[]>([])
  const [selectedNotes, setSelectedNotes]     = useState<string[]>(firstTemplate?.please_note_items ?? [])
  const [price, setPrice]               = useState('')
  const [validUntil, setValidUntil]     = useState(
    firstTemplate ? addDays(firstTemplate.valid_until_days) : ''
  )
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set())

  const activeTemplate = templates.find(t => t.id === templateId) ?? null

  // When a related job is selected, auto-set the client to match
  useEffect(() => {
    if (!relatedJobId) return
    const job = projects.find(p => p.id === relatedJobId)
    if (job?.client_id) setClientId(job.client_id)
  }, [relatedJobId, projects])

  // Auto-fill contact/site from selected client
  useEffect(() => {
    if (!clientId) return
    const client = clientsList.find(c => c.id === clientId)
    if (!client) return
    const filled = new Set<string>()
    setContactName(client.name);           filled.add('contactName')
    setContactPhone(client.phone ?? '');   if (client.phone)         filled.add('contactPhone')
    setContactEmail(client.email ?? '');   if (client.email)         filled.add('contactEmail')
    if (client.address_line1) { setSiteAddress(client.address_line1); filled.add('siteAddress') }
    if (client.suburb)        { setSuburb(client.suburb);             filled.add('suburb') }
    setAutoFilled(prev => new Set([...prev, ...filled]))
  }, [clientId, clientsList])

  // Reset task name, scope, notes, valid-until when template changes
  useEffect(() => {
    if (!activeTemplate) return
    setTaskName(activeTemplate.label)
    setSelectedItems(activeTemplate.scope_items)
    setSelectedNotes(activeTemplate.please_note_items)
    setValidUntil(addDays(activeTemplate.valid_until_days))
    setAutoFilled(prev => new Set([...prev, 'taskName', 'validUntil']))
  }, [templateId]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleItem(item: string) {
    setSelectedItems(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    )
  }

  function toggleNote(note: string) {
    setSelectedNotes(prev =>
      prev.includes(note) ? prev.filter(n => n !== note) : [...prev, note]
    )
  }

  function addSpecifiedItem() {
    setSpecifiedItems(prev => [...prev, { key: makeKey(), value: '' }])
  }
  function updateSpecifiedItem(key: string, value: string) {
    setSpecifiedItems(prev => prev.map(i => i.key === key ? { ...i, value } : i))
  }
  function removeSpecifiedItem(key: string) {
    setSpecifiedItems(prev => prev.filter(i => i.key !== key))
  }

  const handleClientCreated = useCallback((client: Client) => {
    setClientsList(prev => [...prev, client])
    setClientId(client.id)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const priceVal = parseFloat(price)
    if (!price || isNaN(priceVal) || priceVal <= 0) {
      setError('Please enter a valid price.')
      return
    }
    if (!activeTemplate) {
      setError('Please select a survey type.')
      return
    }
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const db = supabase as any

    const { data: { user } } = await supabase.auth.getUser()

    const { data: qNum, error: qErr } = await db.rpc('generate_quote_number')
    if (qErr || !qNum) {
      setError('Failed to generate quote number.')
      setSaving(false)
      return
    }

    const gst   = Math.round(priceVal * 0.1 * 100) / 100
    const total = Math.round((priceVal + gst) * 100) / 100

    const { data: newQuote, error: insertErr } = await db
      .from('quotes')
      .insert({
        quote_number:         qNum,
        status:               'draft',
        created_by:           user?.id ?? null,
        client_id:            clientId || null,
        project_id:           relatedJobId || null,
        contact_name:         contactName || null,
        contact_phone:        contactPhone || null,
        contact_email:        contactEmail || null,
        site_address:         siteAddress || null,
        suburb:               suburb || null,
        lot_number:           lotNumber || null,
        plan_number:          planNumber || null,
        job_type:             taskName || activeTemplate.label,
        template_key:         activeTemplate.id,
        selected_scope_items:   selectedItems,
        specified_scope_items:  specifiedItems.map(i => i.value).filter(Boolean),
        selected_note_items:    selectedNotes,
        subtotal:             priceVal,
        gst_amount:           gst,
        total,
        valid_until:          validUntil || null,
      })
      .select('id')
      .single()

    if (insertErr || !newQuote) {
      setError('Failed to create fee proposal.')
      setSaving(false)
      return
    }

    await db.from('quote_items').insert({
      quote_id:    newQuote.id,
      description: taskName || activeTemplate.label,
      quantity:    1,
      unit_price:  priceVal,
      amount:      priceVal,
      sort_order:  0,
    })

    router.push(`/quotes/${newQuote.id}`)
  }

  // Clear auto-fill flag when user manually edits a field
  function clearAF(field: string) {
    setAutoFilled(prev => { const n = new Set(prev); n.delete(field); return n })
  }

  const client     = clientsList.find(c => c.id === clientId)
  const clientName = client ? (client.company_name ?? client.name) : null
  const priceNum   = parseFloat(price) || 0

  if (templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-slate-600 mb-4">No fee proposal templates found.</p>
          <a href="/quotes/templates/new" className="text-blue-600 hover:underline text-sm">
            Create your first template →
          </a>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full overflow-hidden">

      {/* ── LEFT PANEL ── */}
      <div className="w-1/2 overflow-y-auto border-r border-slate-200 p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Prepare Fee Proposal</h1>
          <p className="text-sm text-slate-500 mt-0.5">Fill in the details — the preview updates live on the right.</p>
        </div>

        {/* Client */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client</h2>
          <div className="flex gap-2">
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">Select a client…</option>
              {clientsList.map(c => (
                <option key={c.id} value={c.id}>{c.company_name ?? c.name}</option>
              ))}
            </select>
            <NewClientModal onClientCreated={handleClientCreated} />
          </div>
        </section>

        {/* Contact */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact Details</h2>
          <div>
            <AutoLabel htmlFor="contactName" filled={autoFilled.has('contactName')}>Contact Name</AutoLabel>
            <Input id="contactName" value={contactName} onChange={e => { setContactName(e.target.value); clearAF('contactName') }} placeholder="e.g. John Smith" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <AutoLabel htmlFor="contactPhone" filled={autoFilled.has('contactPhone')}>Phone</AutoLabel>
              <Input id="contactPhone" value={contactPhone} onChange={e => { setContactPhone(e.target.value); clearAF('contactPhone') }} placeholder="0412 345 678" />
            </div>
            <div>
              <AutoLabel htmlFor="contactEmail" filled={autoFilled.has('contactEmail')}>Email</AutoLabel>
              <Input id="contactEmail" type="email" value={contactEmail} onChange={e => { setContactEmail(e.target.value); clearAF('contactEmail') }} placeholder="john@example.com" />
            </div>
          </div>
        </section>

        {/* Site */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Site Details</h2>
          <div>
            <AutoLabel htmlFor="siteAddress" filled={autoFilled.has('siteAddress')}>Street Address</AutoLabel>
            <Input id="siteAddress" value={siteAddress} onChange={e => { setSiteAddress(e.target.value); clearAF('siteAddress') }} placeholder="e.g. 123 Example St" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <AutoLabel htmlFor="suburb" filled={autoFilled.has('suburb')}>Suburb</AutoLabel>
              <Input id="suburb" value={suburb} onChange={e => { setSuburb(e.target.value); clearAF('suburb') }} placeholder="e.g. Toowong" />
            </div>
            <div>
              <Label htmlFor="lotNumber">Lot No.</Label>
              <Input id="lotNumber" value={lotNumber} onChange={e => setLotNumber(e.target.value)} placeholder="e.g. 12" />
            </div>
          </div>
          <div>
            <Label htmlFor="planNumber">Plan No.</Label>
            <Input id="planNumber" value={planNumber} onChange={e => setPlanNumber(e.target.value)} placeholder="e.g. RP123456" />
          </div>
        </section>

        {/* Related Job */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Related Job <span className="font-normal normal-case text-slate-400">(optional)</span>
          </h2>
          <select
            value={relatedJobId}
            onChange={e => setRelatedJobId(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">No related job</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.job_number} — {p.title}</option>
            ))}
          </select>
        </section>

        <hr className="border-slate-200" />

        {/* Survey Type */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Survey Details</h2>

          <div>
            <Label htmlFor="templateId">Fee Proposal Template</Label>
            <select
              id="templateId"
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <AutoLabel htmlFor="taskName" filled={autoFilled.has('taskName')}>Task Name</AutoLabel>
            <Input
              id="taskName"
              value={taskName}
              onChange={e => { setTaskName(e.target.value); clearAF('taskName') }}
              placeholder="e.g. Contour & Detail Survey — 12 Example St"
            />
            <p className="text-xs text-slate-400 mt-1">This becomes the Task in the app when the quote is accepted.</p>
          </div>

          {/* ── Standard Inclusions (from template) ── */}
          {activeTemplate && (
            <div className="space-y-1.5">
              <div>
                <Label className="mb-0.5 block">Standard Inclusions</Label>
                <p className="text-xs text-slate-400">Items normally included in this type of survey. Tick what applies to this job.</p>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto border border-slate-200 rounded-md p-3 bg-white">
                {activeTemplate.scope_items.map(item => (
                  <label key={item} className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item)}
                      onChange={() => toggleItem(item)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-slate-800"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed group-hover:text-slate-900">{item}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400">{selectedItems.length} of {activeTemplate.scope_items.length} items selected</p>
            </div>
          )}

          {/* ── Specified Inclusions (custom, per-quote) ── */}
          <div className="space-y-1.5">
            <div>
              <Label className="mb-0.5 block">Specified Inclusions</Label>
              <p className="text-xs text-slate-400">Items included for this job that are outside the usual scope. Field staff will see these as extras.</p>
            </div>
            <div className="space-y-2">
              {specifiedItems.map((item, idx) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-5 text-right shrink-0">{idx + 1}.</span>
                  <Input
                    value={item.value}
                    onChange={e => updateSpecifiedItem(item.key, e.target.value)}
                    placeholder="e.g. Set-out of proposed retaining wall"
                    className="flex-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeSpecifiedItem(item.key)}
                    className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSpecifiedItem}
                className="w-full text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Specified Inclusion
              </Button>
            </div>
          </div>

          {/* ── Please Note (from template) ── */}
          {activeTemplate && activeTemplate.please_note_items.length > 0 && (
            <div className="space-y-1.5">
              <Label className="mb-0.5 block">Please Note Items</Label>
              <div className="space-y-1.5 border border-slate-200 rounded-md p-3 bg-white">
                {activeTemplate.please_note_items.map(note => (
                  <label key={note} className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedNotes.includes(note)}
                      onChange={() => toggleNote(note)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-slate-800"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed group-hover:text-slate-900">{note}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Price + Valid Until */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="price">Proposed Fee (ex GST)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <AutoLabel htmlFor="validUntil" filled={autoFilled.has('validUntil')}>Valid Until</AutoLabel>
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={e => { setValidUntil(e.target.value); clearAF('validUntil') }}
                className="mt-1"
              />
            </div>
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {saving ? 'Creating…' : 'Create Fee Proposal'}
        </Button>
      </div>

      {/* ── RIGHT PANEL — Live Preview ── */}
      <div className="w-1/2 overflow-y-auto bg-slate-100 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-4 text-center">Live Preview</p>

        <div
          style={{
            background: 'white',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            maxWidth: '520px',
            margin: '0 auto',
            padding: '32px 36px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '10px',
            color: '#1e293b',
            lineHeight: '1.5',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 'bold' }}>Delfs Lascelles</div>
              <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>Consulting Surveyors</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '8px', lineHeight: '1.7', color: '#475569' }}>
              <div><strong>Date:</strong> {new Date().toLocaleDateString('en-AU')}</div>
              {contactEmail && <div><strong>SENT:</strong> {contactEmail}</div>}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1.5px solid #cbd5e1', marginBottom: '14px' }} />

          {/* Title */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', lineHeight: '1.2' }}>Fee Proposal</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', lineHeight: '1.2' }}>Survey Services</div>
          </div>

          {/* Attention */}
          {(contactName || clientName) && (
            <div style={{ marginBottom: '10px', fontSize: '10px' }}>
              {contactName && <div><strong>Attention</strong> {contactName}</div>}
              {clientName && <div>c/ {clientName}</div>}
            </div>
          )}

          {/* Site */}
          {(siteAddress || suburb || lotNumber || planNumber) && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '7.5px', fontWeight: 'bold', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '3px' }}>Site Address</div>
              {(siteAddress || suburb) && (
                <div>{[siteAddress, suburb].filter(Boolean).join(', ')}</div>
              )}
              {(lotNumber || planNumber) && (
                <div style={{ color: '#64748b', fontSize: '8.5px', marginTop: '1px' }}>
                  {[lotNumber && `Lot ${lotNumber}`, planNumber].filter(Boolean).join(' ')}
                </div>
              )}
            </div>
          )}

          {/* Scope of Work */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '7.5px', fontWeight: 'bold', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Scope of Work</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <tbody>
                <tr style={{ borderBottom: '0.5px solid #e2e8f0' }}>
                  <td style={{ padding: '4px 0', fontSize: '10px' }}>{taskName || activeTemplate?.label || '—'}</td>
                  <td style={{ padding: '4px 0', fontSize: '10px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap', paddingLeft: '12px' }}>
                    {priceNum > 0 ? `${formatCurrency(priceNum)} ex GST` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Standard Inclusions */}
            {selectedItems.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '7px', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px' }}>Standard Inclusions</div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {selectedItems.map((item, i) => (
                    <li key={i} style={{ display: 'flex', gap: '6px', fontSize: '8.5px', lineHeight: '1.5', marginBottom: '2px', color: '#334155' }}>
                      <span style={{ flexShrink: 0, color: '#64748b' }}>•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specified Inclusions */}
            {specifiedItems.filter(i => i.value.trim()).length > 0 && (
              <div style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '7px', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px' }}>Specified Inclusions</div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {specifiedItems.filter(i => i.value.trim()).map((item, i) => (
                    <li key={i} style={{ display: 'flex', gap: '6px', fontSize: '8.5px', lineHeight: '1.5', marginBottom: '2px', color: '#334155' }}>
                      <span style={{ flexShrink: 0, color: '#0ea5e9' }}>◆</span>
                      {item.value}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Please Note */}
          {selectedNotes.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '7.5px', fontWeight: 'bold', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Please Note</div>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {selectedNotes.map((note, i) => (
                  <li key={i} style={{ display: 'flex', gap: '5px', fontSize: '8px', lineHeight: '1.5', color: '#475569', marginBottom: '1px' }}>
                    <span style={{ flexShrink: 0, color: '#94a3b8' }}>•</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Proposed Fee */}
          <div style={{ borderTop: '2px solid #1e293b', paddingTop: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '8.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>Proposed Fee (ex GST)</div>
              <div style={{ fontSize: '7.5px', color: '#64748b', marginTop: '2px', lineHeight: '1.5' }}>
                {validUntil
                  ? `Costings valid until ${formatDateStr(validUntil)}`
                  : 'Costings valid for 60 days of pricing'
                }<br />
                Payment due within 14 days upon invoice received
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
              {priceNum > 0 ? formatCurrency(priceNum) : '—'}
            </div>
          </div>

          {/* Acceptance */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '8.5px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Accepted</div>
            <div style={{ fontSize: '8px', color: '#475569', marginBottom: '16px' }}>I/We accept this fee proposal and the payment terms as quoted above.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {['Signature', 'Date'].map(label => (
                <div key={label}>
                  <div style={{ borderBottom: '0.75px solid #94a3b8', paddingBottom: '24px', marginBottom: '3px' }} />
                  <div style={{ fontSize: '7.5px', color: '#94a3b8' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '0.75px solid #e2e8f0', paddingTop: '8px' }}>
            <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '1px' }}>Kind Regards</div>
            <div style={{ fontSize: '9px', fontWeight: '600' }}>Delfs Lascelles Consulting Surveyors</div>
          </div>
        </div>
      </div>
    </form>
  )
}
