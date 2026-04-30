import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
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
    .order('label', { ascending: true })

  const templateList = (templates ?? []) as FeeProposalTemplate[]

  return (
    <div className="p-8 space-y-6 max-w-5xl">

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/quotes" className="hover:text-slate-700">Quotes</Link>
            <span>/</span>
            <span>Templates</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Fee Proposal Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Templates define the Quote Tasks, items headings, and notes used in fee proposals.
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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Template</th>
                <th className="text-right font-medium px-3 py-2.5 w-28">Quote Tasks</th>
                <th className="text-right font-medium px-3 py-2.5 w-32">Items Headings</th>
                <th className="text-right font-medium px-3 py-2.5 w-20">Notes</th>
                <th className="text-right font-medium px-3 py-2.5 w-28">Valid (days)</th>
                <th className="text-right font-medium px-4 py-2.5 w-36">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templateList.map(t => {
                const tasks = t.quote_tasks ?? []
                const headingCount = tasks.reduce((sum, task) => sum + task.itemsHeadings.length, 0)
                return (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/quotes/templates/${t.id}/edit`} className="font-medium text-slate-900 hover:underline">
                        {t.label}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700 tabular-nums">{tasks.length}</td>
                    <td className="px-3 py-3 text-right text-slate-700 tabular-nums">{headingCount}</td>
                    <td className="px-3 py-3 text-right text-slate-700 tabular-nums">{t.please_note_items.length}</td>
                    <td className="px-3 py-3 text-right text-slate-700 tabular-nums">{t.valid_until_days}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/quotes/templates/${t.id}/edit`}>
                          <Button variant="outline" size="sm">
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Edit
                          </Button>
                        </Link>
                        <DeleteTemplateButton templateId={t.id} templateLabel={t.label} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
