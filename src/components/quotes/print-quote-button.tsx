'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintQuoteButton({ quoteId }: { quoteId: string }) {
  function handlePrint() {
    window.open(`/print/quotes/${quoteId}`, '_blank')
  }

  return (
    <Button variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="h-3.5 w-3.5 mr-1.5" />
      Print Quote
    </Button>
  )
}
