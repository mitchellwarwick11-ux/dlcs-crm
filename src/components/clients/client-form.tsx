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
import { Loader2, User, Building2, Plus, Trash2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { formatAUPhone } from '@/lib/utils/formatters'

interface ContactRow {
  key: string
  id?: string
  name: string
  role: string
  email: string
  phone: string
  is_primary: boolean
}

interface ClientFormProps {
  mode: 'create' | 'edit'
  initialValues?: Partial<ClientFormValues>
  clientId?: string
  initialContacts?: ContactRow[]
}

const STATE_NAME_TO_CODE: Record<string, string> = {
  'new south wales': 'NSW',
  'queensland': 'QLD',
  'victoria': 'VIC',
  'south australia': 'SA',
  'western australia': 'WA',
  'tasmania': 'TAS',
  'northern territory': 'NT',
  'australian capital territory': 'ACT',
}

function toStateCode(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length <= 3) return trimmed.toUpperCase()
  return STATE_NAME_TO_CODE[trimmed.toLowerCase()] ?? trimmed
}

function newContactRow(is_primary = false): ContactRow {
  return {
    key: `new-${Math.random().toString(36).slice(2, 9)}`,
    name: '',
    role: '',
    email: '',
    phone: '',
    is_primary,
  }
}

export function ClientForm({ mode, initialValues, clientId, initialContacts }: ClientFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isCompany, setIsCompany] = useState(
    !!(initialValues?.company_name && initialValues.company_name.trim())
  )

  const [contacts, setContacts] = useState<ContactRow[]>(
    initialContacts && initialContacts.length > 0
      ? initialContacts
      : [newContactRow(true)]
  )

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ClientFormValues>({
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

  function updateContact(key: string, patch: Partial<ContactRow>) {
    setContacts((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)))
  }

  function addContact() {
    setContacts((prev) => [...prev, newContactRow(prev.length === 0)])
  }

  function removeContact(key: string) {
    setContacts((prev) => {
      const filtered = prev.filter((c) => c.key !== key)
      // Ensure there's still a primary if we removed the primary
      if (filtered.length > 0 && !filtered.some((c) => c.is_primary)) {
        filtered[0] = { ...filtered[0], is_primary: true }
      }
      return filtered
    })
  }

  function setPrimary(key: string) {
    setContacts((prev) => prev.map((c) => ({ ...c, is_primary: c.key === key })))
  }

  async function onSubmit(values: ClientFormValues) {
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const db = supabase as any

    // For companies, derive `clients.name` from the primary contact (falls back to company name).
    // For individuals, use the form's Full Name field.
    const primaryContact = contacts.find((c) => c.is_primary && c.name.trim())
      || contacts.find((c) => c.name.trim())
    const derivedName = isCompany
      ? (primaryContact?.name.trim() || values.company_name?.trim() || '')
      : (values.name?.trim() || '')

    if (!derivedName) {
      setError(isCompany
        ? 'Please add at least one contact (or enter a company name).'
        : 'Full name is required.')
      setSubmitting(false)
      return
    }

    const payload = {
      name: derivedName,
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

    let savedClientId: string | undefined = clientId

    if (mode === 'create') {
      const { data, error: err } = await db.from('clients').insert(payload).select().single()
      if (err || !data) {
        setError('Failed to create client. Please try again.')
        setSubmitting(false)
        return
      }
      savedClientId = data.id
    } else {
      const { error: err } = await db.from('clients').update(payload).eq('id', clientId)
      if (err) {
        setError('Failed to update client. Please try again.')
        setSubmitting(false)
        return
      }
    }

    // Save contacts (company clients only)
    if (isCompany && savedClientId) {
      // Simplest pattern: delete all existing, reinsert (matches quote-form line-item flow)
      await db.from('client_contacts').delete().eq('client_id', savedClientId)

      const rowsToInsert = contacts
        .filter((c) => c.name.trim())
        .map((c, idx) => ({
          client_id: savedClientId,
          name: c.name.trim(),
          role: c.role.trim() || null,
          email: c.email.trim() || null,
          phone: c.phone.trim() || null,
          is_primary: c.is_primary,
          sort_order: idx,
        }))

      // Enforce exactly one primary (first row wins if none flagged)
      if (rowsToInsert.length > 0 && !rowsToInsert.some((r) => r.is_primary)) {
        rowsToInsert[0].is_primary = true
      }
      // Clear duplicate primary flags (keep first)
      let primarySeen = false
      for (const r of rowsToInsert) {
        if (r.is_primary) {
          if (primarySeen) r.is_primary = false
          else primarySeen = true
        }
      }

      if (rowsToInsert.length > 0) {
        const { error: contactsErr } = await db.from('client_contacts').insert(rowsToInsert)
        if (contactsErr) {
          setError('Client saved, but contacts failed to save: ' + contactsErr.message)
          setSubmitting(false)
          return
        }
      }
    } else if (!isCompany && savedClientId && mode === 'edit') {
      // If switched from company → individual, clear any existing contacts
      await db.from('client_contacts').delete().eq('client_id', savedClientId)
    }

    if (mode === 'create') {
      router.push(`/clients/${savedClientId}`)
    } else {
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

          {isCompany ? (
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="company_name">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input id="company_name" {...register('company_name')} placeholder="e.g. Smith Developments Pty Ltd" />
              {errors.company_name && <p className="text-xs text-red-500">{errors.company_name.message}</p>}
            </div>
          ) : (
            <>
              <div className="md:col-span-2 space-y-1">
                <Label htmlFor="name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input id="name" {...register('name')} placeholder="e.g. John Smith" />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" {...register('email')} type="email" placeholder="e.g. john@example.com" />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="e.g. 0412 345 678"
                  {...register('phone')}
                  onChange={(e) => {
                    e.target.value = formatAUPhone(e.target.value)
                    register('phone').onChange(e)
                  }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contacts (company only) */}
      {isCompany && (
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <p className="text-sm text-muted-foreground">
              People to contact at this company. Mark one as primary.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {contacts.map((c, idx) => (
              <div
                key={c.key}
                className="relative border border-slate-200 rounded-lg p-3 pr-20"
              >
                {/* Action buttons — top right */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <Button
                    type="button"
                    variant={c.is_primary ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPrimary(c.key)}
                    title={c.is_primary ? 'Primary contact' : 'Set as primary'}
                    className="h-8 px-2"
                  >
                    <Star className={cn('h-3.5 w-3.5', c.is_primary && 'fill-current')} />
                    <span className="ml-1 text-xs">Primary</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeContact(c.key)}
                    disabled={contacts.length === 1}
                    title="Remove contact"
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Name {idx === 0 && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      value={c.name}
                      onChange={(e) => updateContact(c.key, { name: e.target.value })}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Role</Label>
                    <Input
                      value={c.role}
                      onChange={(e) => updateContact(c.key, { role: e.target.value })}
                      placeholder="e.g. Project Manager"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={c.email}
                      onChange={(e) => updateContact(c.key, { email: e.target.value })}
                      type="email"
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input
                      value={c.phone}
                      onChange={(e) => updateContact(c.key, { phone: formatAUPhone(e.target.value) })}
                      placeholder="0412 345 678"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addContact}>
              <Plus className="h-4 w-4 mr-1" />
              Add contact
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle>{isCompany ? 'Business Address' : 'Address'}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="address_line1">Street Address</Label>
            <AddressAutocomplete
              id="address_line1"
              value={watch('address_line1') ?? ''}
              onChange={(v) => setValue('address_line1', v, { shouldDirty: true })}
              onSelect={(pick) => {
                setValue('address_line1', pick.streetAddress, { shouldDirty: true })
                setValue('suburb', pick.suburb || '', { shouldDirty: true })
                setValue('state', toStateCode(pick.state), { shouldDirty: true })
                setValue('postcode', pick.postcode || '', { shouldDirty: true })
              }}
              placeholder="Start typing an address…"
            />
            <p className="text-xs text-slate-500">
              Select a suggestion to auto-fill suburb, state, and postcode.
            </p>
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
