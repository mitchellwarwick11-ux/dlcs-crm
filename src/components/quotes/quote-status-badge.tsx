import { cn } from '@/lib/utils'
import type { QuoteStatus } from '@/types/database'

const COLOURS: Record<QuoteStatus, string> = {
  draft:     'bg-slate-100 text-slate-600',
  issued:    'bg-blue-100  text-blue-700',
  accepted:  'bg-green-100 text-green-700',
  declined:  'bg-red-100   text-red-600',
  cancelled: 'bg-slate-100 text-slate-400',
}

const LABELS: Record<QuoteStatus, string> = {
  draft:     'Draft',
  issued:    'Issued',
  accepted:  'Accepted',
  declined:  'Declined',
  cancelled: 'Cancelled',
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', COLOURS[status])}>
      {LABELS[status]}
    </span>
  )
}
