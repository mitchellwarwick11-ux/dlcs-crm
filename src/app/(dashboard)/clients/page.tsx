import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Building2, User } from 'lucide-react'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactive?: string }>
}) {
  const { q, inactive } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const showInactive = inactive === '1'

  let query = (supabase as any)
    .from('clients')
    .select('id, name, company_name, email, phone, suburb, is_active, projects!projects_client_id_fkey(id, status)')
    .order('name')

  if (!showInactive) {
    query = query.eq('is_active', true)
  }

  if (q?.trim()) {
    query = query.or(`name.ilike.%${q.trim()}%,company_name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`)
  }

  const { data: clients } = await query.limit(200)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">{clients?.length ?? 0} client{clients?.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/clients/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <form className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search clients…"
            className="pl-9"
          />
          {showInactive && <input type="hidden" name="inactive" value="1" />}
        </form>
        <Link
          href={showInactive ? '/clients' : '/clients?inactive=1'}
          className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
        >
          {showInactive ? 'Hide inactive' : 'Show inactive'}
        </Link>
      </div>

      {/* Client list */}
      {!clients || clients.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-sm">{q ? 'No clients match your search.' : 'No clients yet.'}</p>
          {!q && (
            <Link href="/clients/new">
              <Button variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add your first client
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Contact</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Suburb</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Active Jobs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client: any) => {
                  const activeJobs = (client.projects ?? []).filter((p: any) => p.status === 'active').length
                  return (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/clients/${client.id}`} className="flex items-center gap-2.5 group">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            {client.company_name
                              ? <Building2 className="h-3.5 w-3.5 text-slate-500" />
                              : <User className="h-3.5 w-3.5 text-slate-500" />
                            }
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                              {client.company_name ?? client.name}
                            </p>
                            {client.company_name && (
                              <p className="text-xs text-slate-400">{client.name}</p>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {client.email && <p>{client.email}</p>}
                        {client.phone && <p>{client.phone}</p>}
                        {!client.email && !client.phone && <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {client.suburb ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {activeJobs > 0
                          ? <span className="font-medium text-green-600">{activeJobs}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
