import type { InvoiceStatus } from '@/types/database'

const config: Record<InvoiceStatus, { label: string; className: string }> = {
  draft:     { label: 'Draft',     className: 'bg-slate-100 text-slate-600' },
  sent:      { label: 'Sent',      className: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Paid',      className: 'bg-green-100 text-green-700' },
  overdue:   { label: 'Overdue',   className: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-600' },
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, className } = config[status] ?? config.draft
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
