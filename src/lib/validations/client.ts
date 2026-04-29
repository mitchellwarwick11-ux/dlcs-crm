import { z } from 'zod'

export const clientContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  role: z.string().nullable().optional(),
  email: z.string().email('Invalid email').nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  is_primary: z.boolean().default(false),
})

export type ClientContactFormValues = z.infer<typeof clientContactSchema>

export const clientSchema = z.object({
  // name is validated in the form submit handler — for individuals it comes from the
  // Full Name field, for companies it's derived from the primary contact.
  name: z.string().optional(),
  company_name: z.string().nullable().optional(),
  email: z.string().email('Invalid email').nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  suburb: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean(),
})

export type ClientFormValues = z.infer<typeof clientSchema>
