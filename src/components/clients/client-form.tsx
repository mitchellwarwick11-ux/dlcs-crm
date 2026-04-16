'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientSchema, type ClientFormValues } from '@/lib/validations/client'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, User, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClientFormProps {
  mode: 'create' | 'edit'
  initialValues?: Partial<ClientFormValues>
  clientId?: string
}

export function ClientForm({ mode, initialValues, clientId }: ClientFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detect whether this is a company client based on existing data
  const [isCompany, setIsCompany] = useState(
    !!(initialValues?.company_name && initialValues.company_name.trim())
  )

  const { register, handleSubmit, formState: { errors } } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      company_name: '',
      email: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      suburb: '',
      state: 'NSW',
      postcode: '',
      notes: '',
      is_active: true,
      ...initialValues,
    },
  })

  async function onSubmit(values: ClientFormValues) {
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const db = supabase as any

    const payload = {
      // For individuals: name = their full name, company_name = null
      // For companies: name = contact person at the company, company_name = company name
      name: values.name.trim(),
      company_name: isCompany ? (values.company_name?.trim() || null) : null,
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      address_line1: values.address_line1?.trim() || null,
      address_line2: values.address_line2?.trim() || null,
      suburb: values.suburb?.trim() || null,
      state: values.state?.trim() || null,
      postcode: values.postcode?.trim() || null,
      notes: values.notes?.trim() || null,
      is_active: values.is_active,
    }

    if (mode === 'create') {
      const { data, error: err } = await db.from('clients').insert(payload).select().single()
      if (err || !data) {
        setError('Failed to create client. Please try again.')
        setSubmitting(false)
        return
      }
      router.push(`/clients/${data.id}`)
    } else {
      const { error: err } = await db.from('clients').update(payload).eq('id', clientId)
      if (err) {
        setError('Failed to update client. Please try again.')
        setSubmitting(false)
        return
      }
      router.push(`/clients/${clientId}`)
    }

    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Client type toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Client Type</CardTitle>
          <p className="text-sm text-muted-foreground">
            Is this client an individual (e.g. homeowner) or a company?
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsCompany(false)}
              className={cn(
                'flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors',
                !isCompany
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              )}
            >
              <User className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <p className="font-medium">Individual</p>
                <p className={cn('text-xs', !isCompany ? 'text-slate-300' : 'text-slate-400')}>
                  Homeowner, private person
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIsCompany(true)}
              className={cn(
                'flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors',
                isCompany
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              )}
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <p className="font-medium">Company</p>
                <p className={cn('text-xs', isCompany ? 'text-slate-300' : 'text-slate-400')}>
                  Developer, builder, business
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>{isCompany ? 'Company Details' : 'Personal Details'}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {isCompany && (
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="company_name">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input id="company_name" {...register('company_name')} placeholder="e.g. Smith Developments Pty Ltd" />
              {errors.company_name && <p className="text-xs text-red-500">{errors.company_name.message}</p>}
            </div>
          )}

          <div className={isCompany ? 'space-y-1' : 'md:col-span-2 space-y-1'}>
            <Label htmlFor="name">
              {isCompany ? 'Contact Person' : 'Full Name'}{' '}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={isCompany ? 'e.g. John Smith' : 'e.g. John Smith'}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" {...register('email')} type="email" placeholder="e.g. john@example.com" />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} placeholder="e.g. 0412 345 678" />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle>{isCompany ? 'Business Address' : 'Address'}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="address_line1">Street Address</Label>
            <Input id="address_line1" {...register('address_line1')} placeholder="e.g. 123 Main Street" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="address_line2">Address Line 2</Label>
            <Input id="address_line2" {...register('address_line2')} placeholder="e.g. PO Box 456" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="suburb">Suburb</Label>
            <Input id="suburb" {...register('suburb')} placeholder="e.g. Toowoomba" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="state">State</Label>
              <select {...register('state')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">—</option>
                <option value="NSW">NSW</option>
                <option value="QLD">QLD</option>
                <option value="VIC">VIC</option>
                <option value="SA">SA</option>
                <option value="WA">WA</option>
                <option value="TAS">TAS</option>
                <option value="NT">NT</option>
                <option value="ACT">ACT</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="postcode">Postcode</Label>
              <Input id="postcode" {...register('postcode')} placeholder="e.g. 4350" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea id="notes" {...register('notes')} rows={3} placeholder="Any notes about this client…" />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitting ? 'Saving…' : mode === 'create' ? 'Create Client' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  )
}
