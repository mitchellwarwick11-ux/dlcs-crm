'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import type { Client } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Loader2, User, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAUPhone } from '@/lib/utils/formatters'

const quickClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company_name: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
})

type QuickClientValues = z.infer<typeof quickClientSchema>

interface NewClientModalProps {
  onClientCreated: (client: Client) => void
}

export function NewClientModal({ onClientCreated }: NewClientModalProps) {
  const [open, setOpen] = useState(false)
  const [isCompany, setIsCompany] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<QuickClientValues>({
    resolver: zodResolver(quickClientSchema),
  })

  async function onSubmit(values: QuickClientValues) {
    setSubmitting(true)
    setError(null)

    const supabase = createClient()
    const db = supabase as any

    const { data, error: err } = await db
      .from('clients')
      .insert({
        name: values.name.trim(),
        company_name: isCompany ? (values.company_name?.trim() || null) : null,
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        state: null, // Explicitly clear — DB default was 'QLD' on legacy schemas
        is_active: true,
      })
      .select()
      .single()

    if (err || !data) {
      setError('Failed to create client. Please try again.')
      setSubmitting(false)
      return
    }

    onClientCreated(data as Client)
    reset()
    setIsCompany(false)
    setOpen(false)
    setSubmitting(false)
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      reset()
      setError(null)
      setIsCompany(false)
    }
    setOpen(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="shrink-0"
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        New Client
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
          <DialogDescription>
            Add a new client and they&apos;ll be automatically selected for this job.
          </DialogDescription>
        </DialogHeader>

        {/* Type toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsCompany(false)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
              !isCompany
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            )}
          >
            <User className="h-3.5 w-3.5" />
            Individual
          </button>
          <button
            type="button"
            onClick={() => setIsCompany(true)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
              isCompany
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            Company
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

          {isCompany && (
            <div className="space-y-1">
              <Label htmlFor="modal-company">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input id="modal-company" {...register('company_name')} placeholder="e.g. Smith Developments Pty Ltd" autoFocus />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="modal-name">
              {isCompany ? 'Contact Person' : 'Full Name'}{' '}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="modal-name"
              {...register('name')}
              placeholder="e.g. John Smith"
              autoFocus={!isCompany}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="modal-email">Email</Label>
            <Input id="modal-email" {...register('email')} type="email" placeholder="e.g. john@example.com" />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="modal-phone">Phone</Label>
            <Input
              id="modal-phone"
              placeholder="e.g. 0412 345 678"
              {...register('phone')}
              onChange={(e) => {
                e.target.value = formatAUPhone(e.target.value)
                register('phone').onChange(e)
              }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitting ? 'Saving…' : 'Save & Select'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
