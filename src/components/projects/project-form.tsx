'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { projectSchema, type ProjectFormValues } from '@/lib/validations/project'
import { createClient } from '@/lib/supabase/client'
import type { TaskDefinition, Client, StaffProfile } from '@/types/database'
import { JOB_TYPE_OPTIONS } from '@/lib/constants/job-types'
import { USER_ROLES } from '@/lib/constants/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X, Loader2 } from 'lucide-react'
import { NewClientModal } from '@/components/clients/new-client-modal'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { formatAUPhone } from '@/lib/utils/formatters'

interface QuotePrefill {
  quoteId: string
  clientId: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  siteAddress: string | null
  suburb: string | null
  state: string | null
  postcode: string | null
  lotNumber: string | null
  sectionNumber: string | null
  planNumber: string | null
  lga: string | null
  parish: string | null
  county: string | null
  jobType: string | null
  lineItems: { description: string; amount: number }[]
}

interface ProjectFormProps {
  taskDefinitions: TaskDefinition[]
  clients: Client[]
  staff: Pick<StaffProfile, 'id' | 'full_name' | 'role'>[]
  userId: string
  quotePrefill?: QuotePrefill | null
}

export function ProjectForm({ taskDefinitions, clients: initialClients, staff, userId, quotePrefill }: ProjectFormProps) {
  const router = useRouter()
  const [clientsList, setClientsList] = useState<Client[]>(initialClients)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [customTasks, setCustomTasks] = useState<string[]>([])
  const [newCustomTask, setNewCustomTask] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [siteCoords, setSiteCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null })
  const [lotLookupInProgress, setLotLookupInProgress] = useState(false)

  // Warn before navigating away while lot/section/plan are still being fetched
  useEffect(() => {
    if (!lotLookupInProgress) return
    function beforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [lotLookupInProgress])

  const { register, handleSubmit, watch, setValue } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      job_number:   'AUTO',
      job_type:     (quotePrefill?.jobType as any) ?? 'survey',
      is_billable:  true,
      task_ids:     [],
      custom_tasks: [],
      client_id:    quotePrefill?.clientId     ?? '',
      contact_name: quotePrefill?.contactName  ?? '',
      contact_phone: quotePrefill?.contactPhone ?? '',
      contact_email: quotePrefill?.contactEmail ?? '',
      site_address: quotePrefill?.siteAddress   ?? '',
      suburb:       quotePrefill?.suburb        ?? '',
      state:        quotePrefill?.state         ?? '',
      postcode:     quotePrefill?.postcode      ?? '',
      lot_number:     quotePrefill?.lotNumber      ?? '',
      section_number: quotePrefill?.sectionNumber ?? '',
      plan_number:    quotePrefill?.planNumber     ?? '',
      lga:            quotePrefill?.lga            ?? '',
      parish:         quotePrefill?.parish         ?? '',
      county:         quotePrefill?.county         ?? '',
    },
  })

  const jobType = watch('job_type')
  const suburb = watch('suburb')
  const selectedClientId = watch('client_id')

  const selectedClient = clientsList.find(c => c.id === selectedClientId)

  // Auto-fill contact fields when client is selected
  useEffect(() => {
    if (selectedClient) {
      setValue('contact_name', selectedClient.name)
      setValue('contact_phone', selectedClient.phone ?? '')
      setValue('contact_email', selectedClient.email ?? '')
    }
  }, [selectedClientId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClientCreated(newClient: Client) {
    setClientsList(prev => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)))
    setValue('client_id', newClient.id)
  }

  const filteredTasks = taskDefinitions.filter(
    t => t.is_active && (t.applicable_job_type === null || t.applicable_job_type === jobType)
  )

  function toggleTask(id: string) {
    setSelectedTaskIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function addCustomTask() {
    const trimmed = newCustomTask.trim()
    if (trimmed && !customTasks.includes(trimmed)) {
      setCustomTasks(prev => [...prev, trimmed])
      setNewCustomTask('')
    }
  }

  function removeCustomTask(name: string) {
    setCustomTasks(prev => prev.filter(t => t !== name))
  }

  async function onSubmit(values: ProjectFormValues) {
    setSubmitting(true)
    setError(null)
    const supabase = createClient()

    const { data: jobNumberData, error: jnErr } = await supabase.rpc('generate_job_number')
    if (jnErr || !jobNumberData) {
      setError('Failed to generate job number. Please try again.')
      setSubmitting(false)
      return
    }

    const jobNumber = jobNumberData as string
    const year = new Date().getFullYear()
    const sequence = parseInt(jobNumber.slice(2))
    const autoTitle = values.suburb?.trim() || jobNumber

    const db = supabase as any

    const { data: project, error: projErr } = await db
      .from('projects')
      .insert({
        job_number: jobNumber,
        year,
        sequence,
        job_type: values.job_type,
        status: 'active',
        client_id: values.client_id || null,
        job_manager_id: values.job_manager_id || null,
        title: autoTitle,
        description: values.description || null,
        site_address: values.site_address || null,
        suburb: values.suburb || null,
        state: values.state || null,
        postcode: values.postcode || null,
        lot_number: values.lot_number || null,
        section_number: values.section_number || null,
        plan_number: values.plan_number || null,
        lga: values.lga || null,
        parish: values.parish || null,
        county: values.county || null,
        site_lat: siteCoords.lat,
        site_lng: siteCoords.lng,
        purchase_order_number: values.purchase_order_number || null,
        is_billable: values.is_billable,
        created_by: userId,
      })
      .select()
      .single()

    if (projErr || !project) {
      setError('Failed to create project. Please try again.')
      setSubmitting(false)
      return
    }

    const contactName = values.contact_name?.trim()
    if (contactName) {
      await db.from('project_contacts').insert({
        project_id: project.id,
        name: contactName,
        phone: values.contact_phone?.trim() || null,
        email: values.contact_email?.trim() || null,
        is_primary: true,
      })
    }

    const taskInserts = [
      ...selectedTaskIds.map((tid, i) => {
        const def = taskDefinitions.find(t => t.id === tid)
        return { project_id: project.id, task_definition_id: tid, title: def?.name ?? '', status: 'not_started' as const, sort_order: i, created_by: userId }
      }),
      ...customTasks.map((name, i) => ({
        project_id: project.id, task_definition_id: null, title: name, status: 'not_started' as const, sort_order: selectedTaskIds.length + i, created_by: userId,
      })),
    ]

    if (quotePrefill) {
      // Create one task per line item (Fixed Fee), linked back to the source quote
      if (quotePrefill.lineItems.length > 0) {
        // Match each line item title to a task_definition by name (case-
        // insensitive) so the field-app checklist lookup works.
        const defByName = new Map<string, string>()
        for (const def of taskDefinitions) {
          defByName.set(def.name.trim().toLowerCase(), def.id)
        }
        const quoteTaskInserts = quotePrefill.lineItems.map((item, i) => ({
          project_id:         project.id,
          quote_id:           quotePrefill.quoteId,
          task_definition_id: defByName.get((item.description ?? '').trim().toLowerCase()) ?? null,
          title:              item.description,
          fee_type:           'fixed',
          quoted_amount:      item.amount,
          status:             'not_started',
          sort_order:         i,
          created_by:         userId,
        }))
        await db.from('project_tasks').insert(quoteTaskInserts)
      }

      // Always link the quote to the new project and mark as accepted
      await db
        .from('quotes')
        .update({ project_id: project.id, status: 'accepted', approved_at: new Date().toISOString() })
        .eq('id', quotePrefill.quoteId)
    } else if (taskInserts.length > 0) {
      await db.from('project_tasks').insert(taskInserts)
    }

    router.push(`/projects/${project.job_number}/details`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(data => onSubmit({ ...data, task_ids: selectedTaskIds, custom_tasks: customTasks }))} className="space-y-6">

      {/* Job Details */}
      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Job number is assigned automatically. Title will be set to{' '}
            <span className="font-medium text-slate-700">
              {suburb?.trim() ? suburb.trim() : '[Job No]'}
            </span>.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Job Type <span className="text-red-500">*</span></Label>
            <select {...register('job_type')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {JOB_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="job_manager_id">Project Manager</Label>
            <select {...register('job_manager_id')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">— Select manager —</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.full_name} — {USER_ROLES[s.role]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="client_id">Client</Label>
            <div className="flex gap-2 items-start">
              <select {...register('client_id')} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">— No client selected —</option>
                {clientsList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company_name ? `${c.company_name} (${c.name})` : c.name}
                  </option>
                ))}
              </select>
              <NewClientModal onClientCreated={handleClientCreated} />
            </div>
            {/* Client info preview */}
            {selectedClient && (
              <div className="mt-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 space-y-0.5">
                {selectedClient.company_name && <p className="font-medium text-slate-800">{selectedClient.company_name}</p>}
                {selectedClient.email && <p>✉ {selectedClient.email}</p>}
                {selectedClient.phone && <p>📞 {selectedClient.phone}</p>}
                {selectedClient.address_line1 && (
                  <p>📍 {selectedClient.address_line1}{selectedClient.suburb ? `, ${selectedClient.suburb}` : ''}</p>
                )}
              </div>
            )}
          </div>

          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="description">Description / Notes</Label>
            <Textarea id="description" {...register('description')} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <p className="text-sm text-muted-foreground">
            {selectedClient
              ? 'Pre-filled from the selected client — update if the site contact is someone different.'
              : 'Primary contact person for this job.'}
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="contact_name">Name</Label>
            <Input id="contact_name" {...register('contact_name')} placeholder="e.g. John Smith" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact_phone">Phone</Label>
            <Input
              id="contact_phone"
              placeholder="e.g. 0412 345 678"
              {...register('contact_phone')}
              onChange={(e) => {
                e.target.value = formatAUPhone(e.target.value)
                register('contact_phone').onChange(e)
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact_email">Email</Label>
            <Input id="contact_email" {...register('contact_email')} type="email" placeholder="e.g. john@email.com" />
          </div>
        </CardContent>
      </Card>

      {/* Site Details */}
      <Card>
        <CardHeader>
          <CardTitle>Site Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="space-y-1">
            <Label htmlFor="site_address">Site Address</Label>
            <AddressAutocomplete
              id="site_address"
              value={watch('site_address') ?? ''}
              onChange={val => setValue('site_address', val)}
              onLotLookupStart={() => setLotLookupInProgress(true)}
              onLotLookupEnd={() => setLotLookupInProgress(false)}
              onSelect={pick => {
                const opts = { shouldDirty: true, shouldTouch: true }
                setValue('site_address',    pick.streetAddress,      opts)
                setValue('suburb',          pick.suburb || '',       opts)
                setValue('state',           pick.state    || '',     opts)
                setValue('postcode',        pick.postcode || '',     opts)
                setValue('lga',             pick.lga    || '',       opts)
                setValue('parish',          pick.parish || '',       opts)
                setValue('county',          pick.county || '',       opts)
                if (pick.lat !== null && pick.lng !== null) {
                  setSiteCoords({ lat: pick.lat, lng: pick.lng })
                }
                // Lot / section / plan come in a second call ~15s later. Only
                // overwrite when we have real values so the placeholder '-' /
                // blank doesn't flash back in over a filled field.
                if (pick.lot)     setValue('lot_number',     pick.lot,       opts)
                if (pick.plan)    setValue('plan_number',    pick.plan,      opts)
                if (pick.section) setValue('section_number', pick.section,   opts)
                else              setValue('section_number', '-',            opts)
              }}
              placeholder="Start typing a NSW address…"
            />
            <p className="text-xs text-slate-500">Suggestions pulled from NSW Spatial Services. Select one to auto-fill suburb, lot, plan, and LGA.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_160px] gap-4">
            <div className="space-y-1">
              <Label htmlFor="suburb">Suburb</Label>
              <Input id="suburb" {...register('suburb')} placeholder="Auto-filled from address, or type manually" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state">State</Label>
              <Input id="state" {...register('state')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="postcode">Postcode</Label>
              <Input id="postcode" {...register('postcode')} />
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

          {/* Lot / Section / Plan — auto-filled from address */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-1">
              <Label htmlFor="lot_number" className="text-slate-500">Lot Number</Label>
              <Input id="lot_number" {...register('lot_number')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="section_number" className="text-slate-500">Section Number</Label>
              <Input id="section_number" {...register('section_number')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan_number" className="text-slate-500">Plan Number</Label>
              <Input id="plan_number" {...register('plan_number')} />
            </div>
          </div>

          {/* LGA / Parish / County — auto-filled from address */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="lga" className="text-slate-500">LGA</Label>
              <Input id="lga" {...register('lga')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="parish" className="text-slate-500">Parish</Label>
              <Input id="parish" {...register('parish')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="county" className="text-slate-500">County</Label>
              <Input id="county" {...register('county')} />
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <p className="text-sm text-muted-foreground">
            {quotePrefill
              ? 'Tasks below are carried over from the quote line items and will be created as Fixed Fee tasks.'
              : 'Select the tasks that make up this job. You can also add tasks later.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Quote pre-fill: show read-only line items as tasks */}
          {quotePrefill ? (
            <div className="space-y-2">
              {quotePrefill.lineItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-50 border border-slate-200">
                  <span className="text-sm text-slate-800">{item.description}</span>
                  <span className="text-xs text-slate-500 font-medium ml-4 shrink-0">
                    Fixed Fee — ${item.amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
          <div className="flex flex-wrap gap-2">
            {filteredTasks.map(task => {
              const selected = selectedTaskIds.includes(task.id)
              return (
                <button key={task.id} type="button" onClick={() => toggleTask(task.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selected ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
                  }`}>
                  {task.name}
                </button>
              )
            })}
          </div>

          <div className="flex gap-2 pt-1">
            <Input value={newCustomTask} onChange={e => setNewCustomTask(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTask() } }}
              placeholder="+ Add custom task…" className="max-w-xs" />
            <Button type="button" variant="outline" onClick={addCustomTask}><Plus className="h-4 w-4" /></Button>
          </div>

          {customTasks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {customTasks.map(name => (
                <Badge key={name} variant="secondary" className="gap-1 pr-1">
                  {name}
                  <button type="button" onClick={() => removeCustomTask(name)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
          )}
            </>
          )}

        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting || lotLookupInProgress}>
          {(submitting || lotLookupInProgress) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitting ? 'Creating…' : lotLookupInProgress ? 'Waiting for address details…' : 'Create Job'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  )
}
