import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Pencil } from 'lucide-react'
import { DeleteTemplateButton } from '@/components/quotes/delete-template-button'
import type { FeeProposalTemplate } from '@/types/database'

export default async function QuoteTemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any
  const { data: templates } = await db
    .from('fee_proposal_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const templateList = (templates ?? []) as FeeProposalTemplate[]

  return (
    <div className="p-8 space-y-6 max-w-3xl">

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/quotes" className="hover:text-slate-700">Quotes</Link>
            <span>/</span>
            <span>Templates</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Fee Proposal Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Templates define the survey type, scope items, and notes used in fee proposals.
          </p>
        </div>
        <Link href="/quotes/templates/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Template
          </Button>
        </Link>
      </div>

      {templateList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <p className="text-sm text-slate-500 mb-4">No templates yet.</p>
          <Link href="/quotes/templates/new">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1.5" />
              Create First Template
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {templateList.map(t => (
            <Card key={t.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-slate-900">{t.label}</h2>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span>{t.scope_items.length} scope item{t.scope_items.length !== 1 ? 's' : ''}</span>
                      <span>{t.please_note_items.length} note{t.please_note_items.length !== 1 ? 's' : ''}</span>
                      <span>Valid for {t.valid_until_days} days</span>
                    </div>
                    {t.scope_items.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {t.scope_items.slice(0, 3).map((item, i) => (
                          <li key={i} className="text-xs text-slate-500 flex gap-1.5">
                            <span className="text-slate-300 shrink-0">•</span>
                            {item}
                          </li>
                        ))}
                        {t.scope_items.length > 3 && (
                          <li className="text-xs text-slate-400 pl-3.5">
                            + {t.scope_items.length - 3} more…
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/quotes/templates/${t.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                    </Link>
                    <DeleteTemplateButton templateId={t.id} templateLabel={t.label} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
