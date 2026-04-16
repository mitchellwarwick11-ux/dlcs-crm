'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintInvoiceButton({ invoiceId }: { invoiceId: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.open(`/print/invoices/${invoiceId}`, '_blank')}>
      <Printer className="h-3.5 w-3.5 mr-1.5" />
      Print Invoice
    </Button>
  )
}
