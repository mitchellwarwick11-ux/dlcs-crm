import { z } from 'zod'

export const projectSchema = z.object({
  job_number: z.string().min(1, 'Job number is required').regex(/^\S+$/, 'No spaces allowed'),
  job_type: z.enum(['survey', 'sewer_water', 'internal']),
  status: z.enum(['active', 'on_hold', 'completed', 'cancelled', 'archived']).optional(),
  client_id: z.string().nullable().optional(),
  job_manager_id: z.string().nullable().optional(),
  purchase_order_number: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  is_billable: z.boolean(),
  // Contact
  contact_name: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  // Site
  site_address: z.string().nullable().optional(),
  suburb: z.string().nullable().optional(),
  lot_number: z.string().nullable().optional(),
  plan_number: z.string().nullable().optional(),
  // Tasks
  task_ids: z.array(z.string()),
  custom_tasks: z.array(z.string()),
})

export type ProjectFormValues = z.infer<typeof projectSchema>
