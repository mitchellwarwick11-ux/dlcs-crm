'use client'

import { useRouter } from 'next/navigation'

interface Props {
  value: number
  currentMonth?: string
}

export function CycleStartSelector({ value, currentMonth }: Props) {
  const router = useRouter()

  function handleChange(day: number) {
    const qs = new URLSearchParams()
    qs.set('view', 'monthly')
    if (currentMonth) qs.set('month', currentMonth)
    qs.set('cycleStart', String(day))
    router.push(`/timesheets?${qs.toString()}`)
  }

  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <span>Cycle starts on day</span>
      <select
        value={value}
        onChange={e => handleChange(parseInt(e.target.value, 10))}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <span className="text-slate-400">of each month</span>
    </label>
  )
}
