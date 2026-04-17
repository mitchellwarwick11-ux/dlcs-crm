'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { projectSchema, type ProjectFormValues } from '@/lib/validations/project'
import { createClient } from '@/lib/supabase/client'
import type { Client, StaffProfile } from '@/types/database'
import { JOB_TYPE_OPTIONS } from '@/lib/constants/job-types'
import { PROJECT_STATUS_OPTIONS } from '@/lib/constants/statuses'
import { USER_ROLES } from '@/lib/constants/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface ProjectEditFormProps {
  project: any
  primaryContact: any | null
  clients: Client[]
  staff: Pick<StaffProfile, 'id' | 'full_name' | 'role'>[]
}

export function ProjectEditForm({ project, primaryContact, clients, staff }: ProjectEditFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      job_number: project.job_number,
      job_type: project.job_type,
      status: project.status,
      client_id: project.client_id ?? '',
      job_manager_id: project.job_manager_id ?? '',
      description: project.description ?? '',
      is_billable: project.is_billable ?? true,
      contact_name: primaryContact?.name ?? '',
      contact_phone: primaryContact?.phone ?? '',
      contact_email: primaryContact?.email ?? '',
      site_address: project.site_address ?? '',
      suburb: project.suburb ?? '',
      lot_number: project.lot_number ?? '',
      section_number: project.section_number ?? '',
      plan_number: project.plan_number ?? '',
      lga: project.lga ?? '',
      parish: project.parish ?? '',
      county: project.county ?? '',
      task_ids: [],
      custom_tasks: [],
    },
  })

  const suburb = watch('suburb')
  const selectedClientId = watch('client_id')
  const selectedClient = clients.find(c => c.id === selectedClientId)

  async function onSubmit(values: ProjectFormValues) {
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const db = supabase as any

    const newJobNumber = values.job_number.trim()
    const newTitle = values.suburb?.trim()
      ? `${newJobNumber} - ${values.suburb.trim()}`
      : newJobNumber

    const { error: projErr } = await db
      .from('projects')
      .update({
        job_number: newJobNumber,
        job_type: values.job_type,
        status: values.status ?? project.status,
        client_id: values.client_id || null,
        job_manager_id: values.job_manager_id || null,
        title: newTitle,
        description: values.description || null,
        site_address: values.site_address || null,
        suburb: values.suburb || null,
        lot_number: values.lot_number || null,
        section_number: values.section_number || null,
        plan_number: values.plan_number || null,
        lga: values.lga || null,
        parish: values.parish || null,
        county: values.county || null,
        is_billable: values.is_billable,
      })
      .eq('id', project.id)

    if (projErr) {
      setError('Failed to update job. Please try again.')
      setSubmitting(false)
      return
    }

    // Update primary contact
    const contactName = values.contact_name?.trim()
    if (primaryContact) {
      if (contactName) {
        await db.from('project_contacts').update({
          name: contactName,
          phone: values.contact_phone?.trim() || null,
          email: values.contact_email?.trim() || null,
        }).eq('id', primaryContact.id)
      } else {
        await db.from('project_contacts').delete().eq('id', primaryContact.id)
      }
    } else if (contactName) {
      await db.from('project_contacts').insert({
        project_id: project.id,
        name: contactName,
        phone: values.contact_phone?.trim() || null,
        email: values.contact_email?.trim() || null,
        is_primary: true,
      })
    }

    router.push(`/projects/${newJobNumber}/details`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Job Details */}
      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Title will update to{' '}
            <span className="font-medium text-slate-700">
              {suburb?.trim() ? `${project.job_number} - ${suburb.trim()}` : project.job_number}
            </span>.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="job_number">Job Number <span className="text-red-500">*</span></Label>
            <Input id="job_number" {...register('job_number')} />
            {errors.job_number && (
              <p className="text-xs text-red-600">{errors.job_number.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Job Type <span className="text-red-500">*</span></Label>
            <select {...register('job_type')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {JOB_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <select {...register('status')} defaultValue={project.status} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {PROJECT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="job_manager_id">Job Manager</Label>
            <select {...register('job_manager_id')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">— Select manager —</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.full_name} — {USER_ROLES[s.role]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="client_id">Client</Label>
            <select {...register('client_id')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">— No client selected —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.company_name ? `${c.company_name} (${c.name})` : c.name}
                </option>
              ))}
            </select>
            {selectedClient && (
              <div className="mt-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 space-y-0.5">
                {selectedClient.company_name && <p className="font-medium text-slate-800">{selectedClient.company_name}</p>}
                {selectedClient.email && <p>✉ {selectedClient.email}</p>}
                {selectedClient.phone && <p>📞 {selectedClient.phone}</p>}
                {selectedClient.address_line1 && <p>📍 {selectedClient.address_line1}{selectedClient.suburb ? `, ${selectedClient.suburb}` : ''}</p>}
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
          <p className="text-sm text-muted-foreground">Primary contact person for this job.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="contact_name">Name</Label>
            <Input id="contact_name" {...register('contact_name')} placeholder="e.g. John Smith" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact_phone">Phone</Label>
            <Input id="contact_phone" {...register('contact_phone')} placeholder="e.g. 0412 345 678" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact_email">Email</Label>
            <Input id="contact_email" {...register('contact_email')} type="email" placeholder="e.g. john@email.com" />
          </div>
        </CardContent>
      </Card>

      {/* Site Details */}
      <Card>
        <CardHeader><CardTitle>Site Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 space-y-1">
            <Label htmlFor="site_address">Site Address</Label>
            <Input id="site_address" {...register('site_address')} placeholder="Street address" />
          </div>
          <div className="md:col-span-3 space-y-1">
            <Label htmlFor="suburb">Suburb</Label>
            <Input id="suburb" {...register('suburb')} />
          </div>

          {/* Lot / Section / Plan */}
          <div className="space-y-1">
            <Label htmlFor="lot_number">Lot Number</Label>
            <Input id="lot_number" {...register('lot_number')} placeholder="e.g. 5" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="section_number">Section Number</Label>
            <Input id="section_number" {...register('section_number')} placeholder="e.g. 12" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan_number">Plan Number</Label>
            <Input id="plan_number" {...register('plan_number')} placeholder="e.g. DP123456" />
          </div>

          {/* LGA / Parish / County */}
          <div className="space-y-1">
            <Label htmlFor="lga">LGA</Label>
            <Input id="lga" {...register('lga')} placeholder="e.g. Lake Macquarie" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="parish">Parish</Label>
            <Input id="parish" {...register('parish')} placeholder="e.g. Kahibah" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="county">County</Label>
            <Input id="county" {...register('county')} placeholder="e.g. Northumberland" />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitting ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  )
}
