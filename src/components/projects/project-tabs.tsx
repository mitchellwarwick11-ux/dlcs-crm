'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Details',   segment: 'details'   },
  { label: 'Tasks',     segment: 'tasks'     },
  { label: 'Time',      segment: 'time'      },
  { label: 'Invoicing', segment: 'invoices'  },
  { label: 'Documents', segment: 'documents' },
]

export function ProjectTabs({ jobNumber }: { jobNumber: string }) {
  const pathname = usePathname()

  return (
    <div className="border-b border-slate-200 bg-white">
      <nav className="flex gap-0 px-8 -mb-px">
        {tabs.map(tab => {
          const href = `/projects/${jobNumber}/${tab.segment}`
          const active = pathname === href
          return (
            <Link
              key={tab.segment}
              href={href}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                active
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
