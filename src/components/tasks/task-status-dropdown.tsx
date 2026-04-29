'use client'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { TASK_STATUSES, TASK_STATUS_COLOURS } from '@/lib/constants/statuses'
import type { TaskStatus } from '@/lib/constants/statuses'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const ALL_STATUSES: TaskStatus[] = [
  'not_started',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
]

const STATUS_DOT_COLOUR: Record<string, string> = {
  not_started: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  on_hold:     'bg-amber-500',
  completed:   'bg-green-500',
  cancelled:   'bg-red-500',
}

interface Props {
  status: string
  onChange: (next: TaskStatus) => void | Promise<void>
  disabled?: boolean
  /** "sm" matches the small badge in My Work; "md" matches the bigger task-card badge. */
  size?: 'sm' | 'md'
  className?: string
}

export function TaskStatusDropdown({
  status,
  onChange,
  disabled,
  size = 'md',
  className,
}: Props) {
  const label    = TASK_STATUSES[status as TaskStatus] ?? status
  const colour   = TASK_STATUS_COLOURS[status] ?? 'bg-slate-100 text-slate-600'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        title="Change status"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium outline-none transition-opacity',
          size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs',
          colour,
          !disabled && 'cursor-pointer hover:opacity-80',
          disabled && 'opacity-50',
          className,
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT_COLOUR[status] ?? 'bg-current')} />
        {label}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {ALL_STATUSES.map(s => (
          <DropdownMenuItem
            key={s}
            onClick={() => { void onChange(s) }}
            className="gap-2"
          >
            <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT_COLOUR[s])} />
            <span className={cn('flex-1', s === status && 'font-semibold')}>
              {TASK_STATUSES[s]}
            </span>
            {s === status && <Check className="h-3.5 w-3.5 text-slate-500" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
