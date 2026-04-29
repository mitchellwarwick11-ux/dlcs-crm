'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Trash2, Loader2, Archive } from 'lucide-react'

interface ClientDeleteActionProps {
  clientId: string
  displayName: string
  projectCount: number
  quoteCount: number
  isActive: boolean
}

export function ClientDeleteAction({
  clientId,
  displayName,
  projectCount,
  quoteCount,
  isActive,
}: ClientDeleteActionProps) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const hasLinks = projectCount > 0 || quoteCount > 0

  async function hardDelete() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await (supabase as any).from('clients').delete().eq('id', clientId)
    setLoading(false)
    if (err) {
      setError(err.message ?? 'Failed to delete client.')
      return
    }
    setOpen(false)
    router.refresh()
  }

  async function archive() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await (supabase as any)
      .from('clients')
      .update({ is_active: false })
      .eq('id', clientId)
    setLoading(false)
    if (err) {
      setError(err.message ?? 'Failed to archive client.')
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        onClick={(e) => e.stopPropagation()}
        aria-label={`Delete ${displayName}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {hasLinks ? `Can't delete ${displayName}` : `Delete ${displayName}?`}
          </DialogTitle>
          <DialogDescription>
            {hasLinks ? (
              <>
                This client has{' '}
                {projectCount > 0 && (
                  <span className="font-medium text-slate-700">
                    {projectCount} {projectCount === 1 ? 'job' : 'jobs'}
                  </span>
                )}
                {projectCount > 0 && quoteCount > 0 && ' and '}
                {quoteCount > 0 && (
                  <span className="font-medium text-slate-700">
                    {quoteCount} {quoteCount === 1 ? 'quote' : 'quotes'}
                  </span>
                )}
                {' '}linked. Deleting would break those records.
                {isActive && ' You can archive the client instead — they\'ll stop appearing in the main list, but history stays intact.'}
              </>
            ) : (
              <>This permanently removes the client. This can&apos;t be undone.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          {hasLinks ? (
            isActive && (
              <Button onClick={archive} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Archive className="h-4 w-4 mr-2" />}
                Archive client
              </Button>
            )
          ) : (
            <Button variant="destructive" onClick={hardDelete} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete permanently
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
