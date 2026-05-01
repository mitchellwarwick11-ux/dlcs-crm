'use client'

import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Wand2 } from 'lucide-react'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { NewClientModal } from '@/components/clients/new-client-modal'
import { TaskBodyEditor } from '@/components/quotes/task-body-editor'
import { GenericNotesEditor } from '@/components/quotes/generic-notes-editor'
import { RoleRatesInlineEditor } from '@/components/quotes/role-rates-inline-editor'
import { formatCurrency, formatAUPhone, stripJobNumberPrefix } from '@/lib/utils/formatters'
import type { Client, FeeProposalTemplate, GenericNote, QuoteTask, RoleRate } from '@/types/database'

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

interface Project {
  id: string
  job_number: string
  title: string
  client_id: string | null
  site_address?: string | null
  suburb?: string | null
  state?: string | null
  postcode?: string | null
  lot_number?: string | null
  section_number?: string | null
  plan_number?: string | null
  lga?: string | null
  parish?: string | null
  county?: string | null
}

interface QuoteEditData {
  id: string
  client_id: string | null
  project_id: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  site_address: string | null
  suburb: string | null
  state: string | null
  postcode: string | null
  lot_number: string | null
  section_number: string | null
  plan_number: string | null
  lga: string | null
  parish: string | null
  county: string | null
  selected_quote_tasks: QuoteTask[] | null
  selected_note_items: string[] | null
  selected_role_keys: string[] | null
  valid_until: string | null
}

interface FeeProposalFormProps {
  clients: Client[]
  projects: Project[]
  templates: FeeProposalTemplate[]
  genericNotes: GenericNote[]
  roleRates: RoleRate[]
  quote?: QuoteEditData
}

function formatDateStr(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const STATE_ABBR: Record<string, string> = {
  'new south wales': 'NSW',
  'victoria': 'VIC',
  'queensland': 'QLD',
  'south australia': 'SA',
  'western australia': 'WA',
  'tasmania': 'TAS',
  'australian capital territory': 'ACT',
  'northern territory': 'NT',
}
function abbreviateState(s: string): string {
  if (!s) return ''
  const key = s.trim().toLowerCase()
  return STATE_ABBR[key] ?? s.trim().toUpperCase()
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function FeeProposalForm({ clients: initialClients, projects, templates, genericNotes: initialGenericNotes, roleRates: initialRoleRates, quote }: FeeProposalFormProps) {
  const isEdit = !!quote
  const [roleRates, setRoleRates] = useState<RoleRate[]>(initialRoleRates)
  const router = useRouter()

  const [clientsList, setClientsList]   = useState<Client[]>(initialClients)
  const [genericNotes, setGenericNotes] = useState<GenericNote[]>(initialGenericNotes)
  const [clientId, setClientId]         = useState(quote?.client_id ?? '')
  const [contactName, setContactName]   = useState(quote?.contact_name ?? '')
  const [contactPhone, setContactPhone] = useState(quote?.contact_phone ?? '')
  const [contactEmail, setContactEmail] = useState(quote?.contact_email ?? '')
  const [siteAddress, setSiteAddress]   = useState(quote?.site_address ?? '')
  const [suburb, setSuburb]             = useState(quote?.suburb ?? '')
  const [stateCode, setStateCode]       = useState(quote?.state ?? '')
  const [postcode, setPostcode]         = useState(quote?.postcode ?? '')
  const [lotNumber, setLotNumber]       = useState(quote?.lot_number ?? '')
  const [sectionNumber, setSectionNumber] = useState(quote?.section_number ?? '')
  const [planNumber, setPlanNumber]     = useState(quote?.plan_number ?? '')
  const [lga, setLga]                   = useState(quote?.lga ?? '')
  const [parish, setParish]             = useState(quote?.parish ?? '')
  const [county, setCounty]             = useState(quote?.county ?? '')
  const [lotLookupInProgress, setLotLookupInProgress] = useState(false)
  const [relatedJobId, setRelatedJobId] = useState(quote?.project_id ?? '')
  const [quoteTasks, setQuoteTasks]     = useState<QuoteTask[]>(quote?.selected_quote_tasks ?? [])
  const [selectedNotes, setSelectedNotes] = useState<string[]>(quote?.selected_note_items ?? [])
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<string[]>(() =>
    quote
      ? (quote.selected_role_keys ?? [])
      : initialRoleRates.filter(r => r.default_checked).map(r => r.role_key)
  )
  const [validUntil, setValidUntil]     = useState(quote?.valid_until ?? addDays(60))
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set())

  // In edit mode, suppress the relatedJobId / clientId auto-fill effects on initial
  // mount so they don't overwrite the values pre-loaded from the saved quote.
  const skipAutoFillRef = useRef(isEdit)
  useEffect(() => { skipAutoFillRef.current = false }, [])

  // When a related job is selected, auto-set the client and site details to match
  useEffect(() => {
    if (skipAutoFillRef.current) return
    if (!relatedJobId) return
    const job = projects.find(p => p.id === relatedJobId)
    if (!job) return
    if (job.client_id) setClientId(job.client_id)
    const filled = new Set<string>()
    if (job.site_address)   { setSiteAddress(job.site_address);     filled.add('siteAddress') }
    if (job.suburb)         { setSuburb(job.suburb);                 filled.add('suburb') }
    if (job.state)          { setStateCode(job.state);               filled.add('stateCode') }
    if (job.postcode)       { setPostcode(job.postcode);             filled.add('postcode') }
    if (job.lot_number)     { setLotNumber(job.lot_number);          filled.add('lotNumber') }
    if (job.section_number) { setSectionNumber(job.section_number); filled.add('sectionNumber') }
    if (job.plan_number)    { setPlanNumber(job.plan_number);        filled.add('planNumber') }
    if (job.lga)            { setLga(job.lga);                       filled.add('lga') }
    if (job.parish)         { setParish(job.parish);                 filled.add('parish') }
    if (job.county)         { setCounty(job.county);                 filled.add('county') }
    if (filled.size) setAutoFilled(prev => new Set([...prev, ...filled]))
  }, [relatedJobId, projects])

  // Auto-fill contact/site from selected client
  useEffect(() => {
    if (skipAutoFillRef.current) return
    if (!clientId) return
    const client = clientsList.find(c => c.id === clientId)
    if (!client) return
    const filled = new Set<string>()
    setContactName(client.name);           filled.add('contactName')
    setContactPhone(formatAUPhone(client.phone ?? ''));   if (client.phone)         filled.add('contactPhone')
    setContactEmail(client.email ?? '');   if (client.email)         filled.add('contactEmail')
    // Site fields intentionally NOT auto-filled from client — a client may have
    // projects at multiple addresses. Use the address autocomplete instead.
    setAutoFilled(prev => new Set([...prev, ...filled]))
  }, [clientId, clientsList])


  const handleClientCreated = useCallback((client: Client) => {
    setClientsList(prev => [...prev, client])
    setClientId(client.id)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Sum task prices for subtotal.
    const priceVal = quoteTasks.reduce((sum, t) => sum + (t.price ?? 0), 0)
    if (priceVal <= 0) {
      setError('Please enter a price on at least one Quote Task.')
      return
    }
    setSaving(true)
    setError(null)

    // Clean empty tasks/headings/lines before saving.
    const cleanedTasks: QuoteTask[] = quoteTasks
      .map(t => ({
        title: t.title.trim(),
        price: t.price,
        itemsHeadings: t.itemsHeadings
          .map(h => ({
            heading: h.heading.trim(),
            lines: h.lines.map(l => l.trim()).filter(Boolean),
          }))
          .filter(h => h.heading || h.lines.length > 0),
      }))
      .filter(t => t.title || t.itemsHeadings.length > 0 || (t.price ?? 0) > 0)

    const supabase = createClient()
    const db = supabase as any

    const gst   = Math.round(priceVal * 0.1 * 100) / 100
    const total = Math.round((priceVal + gst) * 100) / 100

    const sharedFields = {
      client_id:            clientId || null,
      project_id:           relatedJobId || null,
      contact_name:         contactName || null,
      contact_phone:        contactPhone || null,
      contact_email:        contactEmail || null,
      site_address:         siteAddress || null,
      suburb:               suburb || null,
      state:                stateCode || null,
      postcode:             postcode || null,
      lot_number:           lotNumber || null,
      section_number:       sectionNumber || null,
      plan_number:          planNumber || null,
      lga:                  lga || null,
      parish:               parish || null,
      county:               county || null,
      job_type:             cleanedTasks[0]?.title ?? null,
      selected_note_items:    selectedNotes,
      selected_role_keys:     selectedRoleKeys,
      selected_quote_tasks:   cleanedTasks,
      subtotal:             priceVal,
      gst_amount:           gst,
      total,
      valid_until:          validUntil || null,
    }

    if (isEdit && quote) {
      const { error: updateErr } = await db
        .from('quotes')
        .update(sharedFields)
        .eq('id', quote.id)

      if (updateErr) {
        setError(`Failed to save changes${updateErr.message ? `: ${updateErr.message}` : '.'}`)
        setSaving(false)
        return
      }

      await db.from('quote_items').delete().eq('quote_id', quote.id)
      await db.from('quote_items').insert({
        quote_id:    quote.id,
        description: cleanedTasks[0]?.title ?? 'Fee Proposal',
        quantity:    1,
        unit_price:  priceVal,
        amount:      priceVal,
        sort_order:  0,
      })

      router.push(`/quotes/${quote.id}`)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { data: qNum, error: qErr } = await db.rpc('generate_quote_number')
    if (qErr || !qNum) {
      setError('Failed to generate quote number.')
      setSaving(false)
      return
    }

    const { data: newQuote, error: insertErr } = await db
      .from('quotes')
      .insert({
        ...sharedFields,
        quote_number:         qNum,
        status:               'draft',
        created_by:           user?.id ?? null,
        template_key:         null,
        selected_scope_items:   [] as string[],
        specified_scope_items:  [] as string[],
      })
      .select('id')
      .single()

    if (insertErr || !newQuote) {
      setError(`Failed to create fee proposal${insertErr?.message ? `: ${insertErr.message}` : '.'}`)
      setSaving(false)
      return
    }

    await db.from('quote_items').insert({
      quote_id:    newQuote.id,
      description: cleanedTasks[0]?.title ?? 'Fee Proposal',
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

  function clearSiteDetails() {
    setSiteAddress(''); setSuburb(''); setStateCode(''); setPostcode('')
    setLotNumber(''); setSectionNumber(''); setPlanNumber('')
    setLga(''); setParish(''); setCounty('')
    setAutoFilled(prev => {
      const n = new Set(prev)
      ;['siteAddress','suburb','stateCode','postcode','lotNumber','sectionNumber','planNumber','lga','parish','county']
        .forEach(f => n.delete(f))
      return n
    })
  }

  const client     = clientsList.find(c => c.id === clientId)
  const clientName = client ? (client.company_name ?? client.name) : null
  const priceNum   = quoteTasks.reduce((sum, t) => sum + (t.price ?? 0), 0)

  // Importable Quote Tasks, flattened from all active templates.
  const taskImportOptions = templates.flatMap(t =>
    (t.quote_tasks ?? []).map((task, i) => ({
      id: `${t.id}:${i}`,
      label: `${t.label}${task.title ? ` — ${task.title}` : ''}`,
      task,
    }))
  )

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
          <h1 className="text-xl font-semibold text-slate-900">{isEdit ? 'Edit Fee Proposal' : 'Prepare Fee Proposal'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Fill in the details — the preview updates live on the right.</p>
        </div>

        {/* Related Job */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Related Job <span className="font-normal normal-case text-slate-400">(optional)</span>
          </h2>
          <select
            value={relatedJobId}
            onChange={e => {
              clearSiteDetails()
              setRelatedJobId(e.target.value)
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">No related job</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.job_number} — {stripJobNumberPrefix(p.title, p.job_number)}</option>
            ))}
          </select>
        </section>

        {/* Client */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client</h2>
          <div className="flex gap-2">
            <select
              value={clientId}
              onChange={e => {
                const newId = e.target.value
                setClientId(newId)
                // If the currently-selected related job belongs to a different client, clear it
                // and wipe site details that were auto-filled from that job.
                if (relatedJobId) {
                  const job = projects.find(p => p.id === relatedJobId)
                  if (job && job.client_id && job.client_id !== newId) {
                    setRelatedJobId('')
                    clearSiteDetails()
                  }
                }
              }}
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
            <Input id="contactName" className="bg-white" value={contactName} onChange={e => { setContactName(e.target.value); clearAF('contactName') }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <AutoLabel htmlFor="contactPhone" filled={autoFilled.has('contactPhone')}>Phone</AutoLabel>
              <Input id="contactPhone" className="bg-white" value={contactPhone} onChange={e => { setContactPhone(formatAUPhone(e.target.value)); clearAF('contactPhone') }} />
            </div>
            <div>
              <AutoLabel htmlFor="contactEmail" filled={autoFilled.has('contactEmail')}>Email</AutoLabel>
              <Input id="contactEmail" className="bg-white" type="email" value={contactEmail} onChange={e => { setContactEmail(e.target.value); clearAF('contactEmail') }} />
            </div>
          </div>
        </section>

        {/* Site */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Site Details</h2>

          <div className="space-y-1">
            <AutoLabel htmlFor="siteAddress" filled={autoFilled.has('siteAddress')}>Site Address</AutoLabel>
            <AddressAutocomplete
              id="siteAddress"
              value={siteAddress}
              onChange={v => { setSiteAddress(v); clearAF('siteAddress') }}
              inputClassName="bg-violet-50 border-violet-200"
              onLotLookupStart={() => setLotLookupInProgress(true)}
              onLotLookupEnd={() => setLotLookupInProgress(false)}
              onSelect={pick => {
                setSiteAddress(pick.streetAddress)
                setSuburb(pick.suburb || '')
                setStateCode(pick.state || '')
                setPostcode(pick.postcode || '')
                setLga(pick.lga || '')
                setParish(pick.parish || '')
                setCounty(pick.county || '')
                if (pick.lot)     setLotNumber(pick.lot)
                if (pick.plan)    setPlanNumber(pick.plan)
                if (pick.section) setSectionNumber(pick.section)
                else              setSectionNumber('-')
              }}
              placeholder="Start typing a NSW address…"
            />
            <p className="text-xs text-slate-500">Suggestions pulled from NSW Spatial Services. Select one to auto-fill suburb, lot, plan, and LGA.</p>
          </div>

          <div className="grid grid-cols-[1fr_1fr_120px] gap-2">
            <div>
              <AutoLabel htmlFor="suburb" filled={autoFilled.has('suburb')}>Suburb</AutoLabel>
              <Input id="suburb" className="bg-slate-100" value={suburb} onChange={e => { setSuburb(e.target.value); clearAF('suburb') }} />
            </div>
            <div>
              <AutoLabel htmlFor="stateCode" filled={autoFilled.has('stateCode')}>State</AutoLabel>
              <Input id="stateCode" className="bg-slate-100" value={stateCode} onChange={e => { setStateCode(e.target.value); clearAF('stateCode') }} />
            </div>
            <div>
              <AutoLabel htmlFor="postcode" filled={autoFilled.has('postcode')}>Postcode</AutoLabel>
              <Input id="postcode" className="bg-slate-100" value={postcode} onChange={e => { setPostcode(e.target.value); clearAF('postcode') }} />
            </div>
          </div>

          {lotLookupInProgress && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Loader2 className="h-3.5 w-3.5 mt-0.5 shrink-0 animate-spin" />
              <div>
                <p className="font-medium">Looking up Lot, Section, Plan, LGA, Parish and County…</p>
                <p className="text-amber-700">This can take up to 15 seconds. Please don't leave the page — the fields below will fill automatically.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            <div>
              <AutoLabel htmlFor="lotNumber" filled={autoFilled.has('lotNumber')}>Lot Number</AutoLabel>
              <Input id="lotNumber" className="bg-slate-100" value={lotNumber} onChange={e => { setLotNumber(e.target.value); clearAF('lotNumber') }} />
            </div>
            <div>
              <AutoLabel htmlFor="sectionNumber" filled={autoFilled.has('sectionNumber')}>Section Number</AutoLabel>
              <Input id="sectionNumber" className="bg-slate-100" value={sectionNumber} onChange={e => { setSectionNumber(e.target.value); clearAF('sectionNumber') }} />
            </div>
            <div>
              <AutoLabel htmlFor="planNumber" filled={autoFilled.has('planNumber')}>Plan Number</AutoLabel>
              <Input id="planNumber" className="bg-slate-100" value={planNumber} onChange={e => { setPlanNumber(e.target.value); clearAF('planNumber') }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <AutoLabel htmlFor="lga" filled={autoFilled.has('lga')}>LGA</AutoLabel>
              <Input id="lga" className="bg-slate-100" value={lga} onChange={e => { setLga(e.target.value); clearAF('lga') }} />
            </div>
            <div>
              <AutoLabel htmlFor="parish" filled={autoFilled.has('parish')}>Parish</AutoLabel>
              <Input id="parish" className="bg-slate-100" value={parish} onChange={e => { setParish(e.target.value); clearAF('parish') }} />
            </div>
            <div>
              <AutoLabel htmlFor="county" filled={autoFilled.has('county')}>County</AutoLabel>
              <Input id="county" className="bg-slate-100" value={county} onChange={e => { setCounty(e.target.value); clearAF('county') }} />
            </div>
          </div>
        </section>

        <hr className="border-slate-200" />

        {/* Survey Type */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Survey Details</h2>

          {/* ── Quote Body (Task → Items Heading → Info Lines) ── */}
          <div className="space-y-1.5">
            <div>
              <Label className="mb-0.5 block">Quote Body</Label>
              <p className="text-xs text-slate-400">Start with a blank Quote Task, or import one from a template via the picker below. Add headings and info lines as needed; enter a price for each task.</p>
            </div>
            <TaskBodyEditor
              tasks={quoteTasks}
              onChange={setQuoteTasks}
              showPrices
              importOptions={taskImportOptions}
              roleRates={roleRates}
            />
          </div>

          {/* ── Generic Notes (firm-wide, checkable, editable) ── */}
          <GenericNotesEditor
            notes={genericNotes}
            selected={selectedNotes}
            onSelectedChange={setSelectedNotes}
            onNotesChange={setGenericNotes}
          />

          {/* ── Hourly Rates (checkable, per-role; inline manage) ── */}
          <RoleRatesInlineEditor
            roleRates={roleRates}
            selected={selectedRoleKeys}
            onSelectedChange={setSelectedRoleKeys}
            onRoleRatesChange={setRoleRates}
          />

          {/* Proposed Fee summary + Valid Until */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Proposed Fee (ex GST)</Label>
              <div className="mt-1 h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm flex items-center text-slate-700">
                {priceNum > 0 ? formatCurrency(priceNum) : '—'}
                <span className="ml-2 text-xs text-slate-400">(sum of Quote Task prices)</span>
              </div>
            </div>
            <div>
              <AutoLabel htmlFor="validUntil" filled={autoFilled.has('validUntil')}>Valid Until</AutoLabel>
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={e => { setValidUntil(e.target.value); clearAF('validUntil') }}
                className="mt-1 bg-white"
              />
            </div>
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Fee Proposal')}
        </Button>
      </div>

      {/* ── RIGHT PANEL — Live Preview ── */}
      <div className="w-1/2 overflow-y-auto bg-slate-100 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-4 text-center">Live Preview</p>

        <div
          style={{
            background: 'white',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            maxWidth: '560px',
            margin: '0 auto',
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '10px',
            color: '#2b2f36',
            lineHeight: '1.5',
            paddingBottom: '48px',
            position: 'relative',
          }}
        >
          {/* ===== DARK HEADER ===== */}
          <div style={{ background: '#111111', color: 'white', padding: '18px 22px 22px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
              <div style={{ width: '3px', background: '#e89a3c' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px', lineHeight: 1, letterSpacing: '0.01em', textTransform: 'uppercase' }}>DELFS<br />LASCELLES</div>
                <div style={{ fontSize: '6.5px', letterSpacing: '0.22em', color: '#cbd5e1', marginTop: '4px', textTransform: 'uppercase' }}>Consulting Surveyors</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '8px', lineHeight: '1.55', color: '#e5e7eb' }}>
              <div>(02) 4964 4886</div>
              <div>260 Maitland Road, Mayfield 2304</div>
              <div>admin@delacs.com.au</div>
              <div style={{ marginTop: '3px' }}>
                <span style={{ color: '#e89a3c', fontWeight: 700, letterSpacing: '0.05em', borderBottom: '1px solid #e89a3c', paddingBottom: '1px', display: 'inline-block' }}>DELACS.COM.AU</span>
              </div>
            </div>
          </div>

          <div style={{ padding: '20px 22px 0 22px' }}>
            {/* ===== TITLE + META ===== */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#1a1a1a', lineHeight: 1.05, letterSpacing: '-0.01em' }}>FEE PROPOSAL</div>
                <div style={{ fontSize: '8.5px', letterSpacing: '0.28em', color: '#4b5563', marginTop: '5px', paddingBottom: '3px', display: 'inline-block', borderBottom: '1.5px solid #e89a3c', textTransform: 'uppercase' }}>Survey Services</div>
              </div>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', columnGap: '8px', rowGap: '2px', fontSize: '8px', alignItems: 'center' }}>
                  <div style={{ color: '#64748b', letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: '7px' }}>Date</div>
                  <div style={{ width: '1px', height: '9px', background: '#cbd5e1', margin: '0 4px' }} />
                  <div style={{ color: '#1a1a1a', fontWeight: 700, fontSize: '9px' }}>{new Date().toLocaleDateString('en-AU')}</div>
                  <div style={{ color: '#64748b', letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: '7px' }}>Reference</div>
                  <div style={{ width: '1px', height: '9px', background: '#cbd5e1', margin: '0 4px' }} />
                  <div style={{ color: '#1a1a1a', fontWeight: 700, fontSize: '9px' }}>—</div>
                </div>
                {(contactName || contactEmail) && (
                  <div style={{ textAlign: 'right', color: '#64748b', fontSize: '7.5px', marginTop: '5px' }}>
                    SENT: {contactName ?? ''}{contactEmail ? `  ${contactEmail}` : ''}
                  </div>
                )}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '0.75px solid #e5e7eb', marginBottom: '10px' }} />

            {/* ===== ATTENTION ===== */}
            {contactName && (
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', columnGap: '14px', padding: '8px 0', borderBottom: '0.5px solid #e5e7eb' }}>
                <div style={{ fontSize: '7px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748b', paddingRight: '10px', borderRight: '0.75px solid #e5e7eb' }}>Attention</div>
                <div style={{ fontWeight: 800, fontSize: '9.5px', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{contactName}</div>
              </div>
            )}

            {/* ===== COMPANY ===== */}
            {clientName && (
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', columnGap: '14px', padding: '8px 0', borderBottom: '0.5px solid #e5e7eb' }}>
                <div style={{ fontSize: '7px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748b', paddingRight: '10px', borderRight: '0.75px solid #e5e7eb' }}>Company</div>
                <div style={{ fontWeight: 800, fontSize: '9.5px', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{clientName}</div>
              </div>
            )}

            {/* ===== SITE ADDRESS ===== */}
            {(() => {
              const isStrata = /^sp/i.test(planNumber.trim())
              const stateAbbr = abbreviateState(stateCode)
              const showSection = !!sectionNumber && sectionNumber.trim() !== '' && sectionNumber.trim() !== '-'
              const lotLineParts = isStrata
                ? [planNumber]
                : [
                    lotNumber && `Lot ${lotNumber}`,
                    showSection && `Section ${sectionNumber}`,
                    planNumber,
                  ].filter(Boolean)
              const locality = [suburb, stateAbbr, postcode].filter(Boolean).join(' ')
              const anySite = siteAddress || locality || lotLineParts.length > 0
              if (!anySite) return null
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', columnGap: '14px', padding: '8px 0', borderBottom: '0.5px solid #e5e7eb' }}>
                  <div style={{ fontSize: '7px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748b', paddingRight: '10px', borderRight: '0.75px solid #e5e7eb' }}>Site Address</div>
                  <div style={{ fontSize: '9px', lineHeight: 1.6 }}>
                    {siteAddress && <div>{siteAddress}</div>}
                    {locality && <div>{locality}</div>}
                    {lotLineParts.length > 0 && <div>{lotLineParts.join(', ')}</div>}
                  </div>
                </div>
              )
            })()}

            <div style={{ height: 8 }} />

            {/* ===== QUOTE TASKS ===== */}
            {quoteTasks.map((task, ti) => {
              const hasContent = task.title || task.itemsHeadings.some(h => h.heading || h.lines.some(l => l.trim()))
              if (!hasContent && !(task.price ?? 0)) return null
              const renderableHeadings = task.itemsHeadings
                .map(h => ({ heading: h.heading, lines: h.lines.filter(l => l.trim()) }))
                .filter(h => h.heading || h.lines.length > 0)
              return (
                <div key={ti} style={{ borderBottom: '0.5px solid #e5e7eb', paddingBottom: '6px', marginBottom: '2px' }}>
                  {/* Task title (starts at the far-left gutter, spans across the content area) + price */}
                  {(task.title || (task.price ?? 0) > 0) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: '14px', padding: '4px 0 2px' }}>
                      <div style={{ fontWeight: 800, fontSize: '11px', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.3 }}>
                        {task.title || ''}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap', paddingLeft: '12px', lineHeight: 1.05 }}>
                        {(task.price ?? 0) > 0 ? formatCurrency(task.price!) : '—'}
                        <div style={{ fontSize: '7px', letterSpacing: '0.15em', color: '#64748b', fontWeight: 500, marginTop: '-1px', lineHeight: 1 }}>ex GST</div>
                      </div>
                    </div>
                  )}
                  {/* One row per items heading */}
                  {renderableHeadings.map((h, hi) => (
                    <div key={hi} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', columnGap: '14px', padding: '2px 0' }}>
                      <div style={{ paddingRight: '10px', borderRight: '0.75px solid #e5e7eb', lineHeight: 1.4 }}>
                        {h.heading && (
                          <div style={{ fontSize: '7px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748b' }}>
                            {h.heading}
                          </div>
                        )}
                      </div>
                      <div>
                        {h.lines.length > 0 && (
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {h.lines.map((line, li) => (
                              <li key={li} style={{ padding: '0.5px 0', fontSize: '8.5px', color: '#3b4250', lineHeight: 1.4 }}>{line}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}

            {/* ===== PLEASE NOTE ===== */}
            {selectedNotes.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', columnGap: '14px', padding: '4px 0', borderBottom: '0.5px solid #e5e7eb' }}>
                <div style={{ fontSize: '7px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748b', paddingRight: '10px', borderRight: '0.75px solid #e5e7eb', lineHeight: 1.4 }}>Please<br />Note</div>
                <div style={{ fontSize: '8.5px', color: '#3b4250', lineHeight: 1.4 }}>
                  {selectedNotes.map((note, i) => (
                    <div key={i} style={{ padding: '0.5px 0' }}>{note}</div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== STANDARD HOURLY RATES ===== */}
            {(() => {
              const shown = roleRates.filter(r => selectedRoleKeys.includes(r.role_key))
              if (shown.length === 0) return null
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', columnGap: '14px', padding: '4px 0', borderBottom: '0.5px solid #e5e7eb' }}>
                  <div style={{ fontSize: '7px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748b', paddingRight: '10px', borderRight: '0.75px solid #e5e7eb', lineHeight: 1.4 }}>
                    Standard<br />Hourly Rates<br /><span style={{ letterSpacing: '0.12em' }}>(ex GST)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: '2px', columnGap: '24px', fontSize: '8.5px', color: '#3b4250' }}>
                    {shown.map(r => (
                      <Fragment key={r.role_key}>
                        <div>{r.label}</div>
                        <div style={{ textAlign: 'right', fontWeight: 600, color: '#1a1a1a' }}>{formatCurrency(r.hourly_rate)}</div>
                      </Fragment>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* ===== PROPOSED FEE BOX ===== */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', columnGap: '14px', marginTop: '12px' }}>
              <div style={{ fontSize: '7px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748b', padding: '12px 10px 0 0', borderRight: '0.75px solid #e5e7eb', lineHeight: 1.4 }}>
                Proposed Fee
                <span style={{ display: 'block', fontSize: '6.5px', marginTop: '2px' }}>(ex GST)</span>
              </div>
              <div style={{ background: '#fdf3e2', borderLeft: '3px solid #e89a3c', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.01em' }}>
                    {priceNum > 0 ? formatCurrency(priceNum) : '—'}
                  </span>
                  <span style={{ fontSize: '7px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748b' }}>ex GST</span>
                  <span style={{ fontSize: '8px', fontStyle: 'italic', color: '#6b7280' }}>
                    ({validUntil ? `costings valid until ${formatDateStr(validUntil)}` : 'costings valid for 60 days of pricing'})
                  </span>
                </div>
                <div style={{ fontSize: '8.5px', fontWeight: 700, color: '#1a1a1a', marginTop: '5px' }}>Payment due within 14 days upon request</div>
              </div>
            </div>

            {/* ===== SIGN-OFF ===== */}
            <div style={{ paddingTop: '22px' }}>
              <div style={{ fontSize: '8.5px', color: '#3b4250', marginBottom: '10px' }}>Should you require any additional information please do not hesitate to contact me.</div>
              <div style={{ fontSize: '8.5px', color: '#3b4250', marginBottom: '6px' }}>Kind Regards</div>
              <div style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive", fontSize: '16px', color: '#e89a3c', fontStyle: 'italic', borderBottom: '1px solid #e89a3c', display: 'inline-block', paddingBottom: '1px', marginBottom: '4px' }}>Mitch Warwick</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#1a1a1a', marginTop: '3px' }}>Mitch Warwick</div>
              <div style={{ fontSize: '8px', color: '#64748b' }}>Registered Surveyor</div>
              <div style={{ fontSize: '7px', color: '#64748b', marginTop: '1px' }}>Surveyor Registered under the Surveying and Spatial Information Act 2002</div>
            </div>
          </div>

          {/* ===== DARK BOTTOM BAR ===== */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#111111', color: '#e5e7eb', padding: '8px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '7.5px' }}>
            <div>Page 1 of 1</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 700, letterSpacing: '0.08em' }}>DELACS.COM.AU</span>
              <span style={{ width: '1px', height: '9px', background: '#4b5563' }} />
              <span style={{ color: '#cbd5e1', letterSpacing: '0.05em' }}>ABN 28 164 2601 00</span>
              <span style={{ width: '14px', height: '3px', background: '#e89a3c', marginLeft: '6px' }} />
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
