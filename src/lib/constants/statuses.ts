export const PROJECT_STATUSES = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived: 'Archived',
} as const

export type ProjectStatus = keyof typeof PROJECT_STATUSES

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUSES).map(([value, label]) => ({
  value,
  label,
}))

export const QUOTE_STATUSES = {
  draft:     'Draft',
  issued:    'Issued',
  accepted:  'Accepted',
  declined:  'Declined',
  cancelled: 'Cancelled',
} as const

export type QuoteStatus = keyof typeof QUOTE_STATUSES

export const INVOICE_STATUSES = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
} as const

export type InvoiceStatus = keyof typeof INVOICE_STATUSES

export const TASK_STATUSES = {
  not_started: 'Not Started',
  in_progress:  'In Progress',
  on_hold:      'On Hold',
  completed:    'Completed',
  cancelled:    'Cancelled',
} as const

export type TaskStatus = keyof typeof TASK_STATUSES

export const TASK_STATUS_COLOURS: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress:  'bg-blue-100  text-blue-700',
  on_hold:      'bg-amber-100 text-amber-700',
  completed:    'bg-green-100 text-green-700',
  cancelled:    'bg-red-100   text-red-600',
}

// Ordered list for cycling through statuses (excludes cancelled — set manually)
export const TASK_STATUS_CYCLE: TaskStatus[] = [
  'not_started',
  'in_progress',
  'on_hold',
  'completed',
]

export const FEE_TYPES = {
  fixed:        'Fixed Fee',
  hourly:       'Hourly',
  non_billable: 'Non-Billable',
} as const
