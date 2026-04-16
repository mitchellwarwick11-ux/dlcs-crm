'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2, CheckCircle } from 'lucide-react'

export function ClearDemoButton() {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')

  async function handleClear() {
    const confirmed = confirm(
      'This will delete all demo clients, projects, tasks, time entries, and quotes. Your real data will not be affected. Are you sure?'
    )
    if (!confirmed) return

    setStatus('loading')
    const supabase = createClient()
    const db = supabase as any

    // Fetch demo project IDs
    const { data: demoProjects } = await db
      .from('projects')
      .select('id')
      .eq('description', '[demo-seed]')
    const projectIds = (demoProjects ?? []).map((r: any) => r.id)

    // Fetch demo quote IDs
    const { data: demoQuotes } = await db
      .from('quotes')
      .select('id')
      .eq('notes', '[demo-seed]')
    const quoteIds = (demoQuotes ?? []).map((r: any) => r.id)

    // 1. Time entries linked to demo projects
    if (projectIds.length > 0) {
      await db.from('time_entries').delete().in('project_id', projectIds)
    }

    // 2. Project tasks linked to demo projects
    if (projectIds.length > 0) {
      await db.from('project_tasks').delete().in('project_id', projectIds)
    }

    // 3. Quote items linked to demo quotes
    if (quoteIds.length > 0) {
      await db.from('quote_items').delete().in('quote_id', quoteIds)
    }

    // 4. Demo quotes
    await db.from('quotes').delete().eq('notes', '[demo-seed]')

    // 5. Demo projects
    await db.from('projects').delete().eq('description', '[demo-seed]')

    // 6. Demo clients
    await db.from('clients').delete().eq('notes', '[demo-seed]')

    setStatus('done')
    setTimeout(() => {
      setStatus('idle')
      router.refresh()
    }, 2000)
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle className="h-4 w-4" />
        Demo data cleared successfully.
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      onClick={handleClear}
      disabled={status === 'loading'}
      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
    >
      {status === 'loading' ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Clearing…
        </>
      ) : (
        <>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Demo Data
        </>
      )}
    </Button>
  )
}
