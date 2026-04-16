'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle } from 'lucide-react'

interface Props {
  initial: Record<string, string>
}

const FIELDS = [
  { key: 'company_name',   label: 'Company Name',   placeholder: 'Delfs Lascelles Consulting Surveyors' },
  { key: 'abn',            label: 'ABN',             placeholder: '12 345 678 901' },
  { key: 'bank_name',      label: 'Bank',            placeholder: 'Commonwealth Bank' },
  { key: 'bsb',            label: 'BSB',             placeholder: '062-000' },
  { key: 'account_number', label: 'Account Number',  placeholder: '1234 5678' },
  { key: 'account_name',   label: 'Account Name',    placeholder: 'Delfs Lascelles Consulting Surveyors' },
]

export function CompanySettingsForm({ initial }: Props) {
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  function set(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    const db = createClient() as any

    await Promise.all(
      FIELDS.map(({ key }) =>
        db.from('company_settings')
          .update({ value: values[key] ?? '' })
          .eq('key', key)
      )
    )

    setStatus('saved')
    setTimeout(() => setStatus('idle'), 2500)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className={key === 'company_name' ? 'col-span-2' : ''}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <input
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={values[key] ?? ''}
              onChange={e => set(key, e.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
          ) : 'Save'}
        </Button>
        {status === 'saved' && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Saved
          </span>
        )}
      </div>
    </form>
  )
}
