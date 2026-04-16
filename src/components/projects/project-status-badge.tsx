import { Badge } from '@/components/ui/badge'
import type { ProjectStatus } from '@/types/database'

const config: Record<ProjectStatus, { label: string; className: string }> = {
  active:    { label: 'Active',    className: 'bg-green-100 text-green-800 border-green-200' },
  on_hold:   { label: 'On Hold',   className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  completed: { label: 'Completed', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200' },
  archived:  { label: 'Archived',  className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = config[status] ?? config.active
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}
