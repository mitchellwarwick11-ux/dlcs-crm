'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const STORAGE_KEY = 'reports-date-filter'

interface DateFilterFormProps {
  /** Initial values from the server (URL search params) */
  initialFrom: string
  initialTo:   string
}

export function DateFilterForm({ initialFrom, initialTo }: DateFilterFormProps) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [from, setFrom] = useState(initialFrom)
  const [to,   setTo  ] = useState(initialTo)

  // On first mount, if no URL params were present, restore from localStorage
  useEffect(() => {
    const hasUrlParams = searchParams.has('from') || searchParams.has('to')
    if (!hasUrlParams) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const { from: f, to: t } = JSON.parse(saved)
          if (f && t) {
            setFrom(f)
            setTo(t)
            // Push into URL so the server component re-fetches with saved dates
            router.replace(`?from=${f}&to=${t}`)
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ from, to }))
    } catch { /* ignore */ }
    router.push(`?from=${from}&to=${to}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-5 bg-white border border-slate-200 rounded-lg px-5 py-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">Date From</label>
        <p className="text-xs text-slate-400 leading-none mb-1">Start of period</p>
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">Date To</label>
        <p className="text-xs text-slate-400 leading-none mb-1">End of period</p>
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        className="px-5 py-1.5 bg-slate-900 text-white text-sm font-medium rounded hover:bg-slate-700 transition-colors self-end"
      >
        Apply
      </button>
    </form>
  )
}
