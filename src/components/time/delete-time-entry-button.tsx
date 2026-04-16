'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2 } from 'lucide-react'

interface DeleteTimeEntryButtonProps {
  entryId: string
  invoiced: boolean
}

export function DeleteTimeEntryButton({ entryId, invoiced }: DeleteTimeEntryButtonProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  if (invoiced) {
    return (
      <button
        disabled
        title="Cannot delete — this entry has been invoiced"
        className="p-1 text-slate-300 cursor-not-allowed"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )
  }

  async function handleDelete() {
    if (!confirm('Delete this time entry?')) return
    setDeleting(true)
    const supabase = createClient()
    await (supabase as any).from('time_entries').delete().eq('id', entryId)
    router.refresh()
    setDeleting(false)
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="Delete entry"
      className="p-1 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
