'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { InvoiceStatus } from '@/types/database'

export function InvoiceStatusActions({
  invoiceId,
  status,
}: {
  invoiceId: string
  status: InvoiceStatus
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function update(patch: Record<string, unknown>) {
    setLoading(true)
    const db = createClient() as any
    await db.from('invoices').update(patch).eq('id', invoiceId)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {status === 'draft' && (
        <Button
          size="sm"
          onClick={() => update({ status: 'sent', sent_at: new Date().toISOString() })}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark as Sent'}
        </Button>
      )}

      {status === 'sent' && (
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => update({ status: 'paid', paid_at: new Date().toISOString() })}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark as Paid'}
        </Button>
      )}

      {(status === 'draft' || status === 'sent') && (
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => {
            if (confirm('Cancel this invoice?')) update({ status: 'cancelled' })
          }}
          disabled={loading}
        >
          Cancel Invoice
        </Button>
      )}
    </div>
  )
}
