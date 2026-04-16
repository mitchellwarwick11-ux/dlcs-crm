'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'

interface DeleteTemplateButtonProps {
  templateId: string
  templateLabel: string
}

export function DeleteTemplateButton({ templateId, templateLabel }: DeleteTemplateButtonProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete "${templateLabel}"? This cannot be undone.`)) return
    setDeleting(true)
    const db = createClient() as any
    await db.from('fee_proposal_templates').update({ is_active: false }).eq('id', templateId)
    router.refresh()
    setDeleting(false)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
      {deleting
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Trash2 className="h-3.5 w-3.5 text-red-500" />
      }
    </Button>
  )
}
