import { Badge } from '@/components/ui/badge'
import type { ProjectStatus } from '@/types/database'

const config: Record<ProjectStatus, { label: string; className: string }> = {
  active:    { label: 'Active',    className: 'bg-[#E7F3EC] text-[#1F7A3F] border-transparent' },
  on_hold:   { label: 'On Hold',   className: 'bg-[#FBF1D8] text-[#A86B0C] border-transparent' },
  completed: { label: 'Completed', className: 'bg-[#E6EEF7] text-[#2257A3] border-transparent' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-transparent' },
  archived:  { label: 'Archived',  className: 'bg-[#EFEDE6] text-dlcs-ink-muted border-transparent' },
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = config[status] ?? config.active
  return (
    <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${className}`}>
      {label}
    </Badge>
  )
}
