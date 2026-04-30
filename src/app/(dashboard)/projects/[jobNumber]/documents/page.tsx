import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Download, Camera } from 'lucide-react'

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ jobNumber: string }>
}) {
  const { jobNumber } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('job_number', jobNumber)
    .returns<any[]>()
    .single()

  if (!project) notFound()

  const { data: docs } = await db
    .from('documents')
    .select('id, file_name, file_path, file_size_bytes, mime_type, uploaded_at')
    .eq('project_id', (project as any).id)
    .order('uploaded_at', { ascending: false })

  const docList = (docs ?? []) as any[]

  const { data: visitRows } = await db
    .from('field_schedule_entries')
    .select(`
      id, date,
      project_tasks ( title ),
      field_photos ( id, type ),
      jsa_submissions ( id )
    `)
    .eq('project_id', (project as any).id)
    .order('date', { ascending: false })

  const visits = ((visitRows ?? []) as any[])
    .map((e) => {
      const photos = (e.field_photos ?? []) as any[]
      return {
        id:             e.id,
        date:           e.date as string,
        taskTitle:      e.project_tasks?.title ?? null,
        sitePhotoCount: photos.filter((p) => p.type === 'site_photo').length,
        fieldnoteCount: photos.filter((p) => p.type === 'fieldbook_note').length,
        hasJsa:         (e.jsa_submissions ?? []).length > 0,
      }
    })
    .filter((v) => v.hasJsa || v.sitePhotoCount > 0 || v.fieldnoteCount > 0)

  // Generate signed URLs (1 hour expiry)
  const docsWithUrls = await Promise.all(
    docList.map(async (doc: any) => {
      const { data } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(doc.file_path, 3600)
      return { ...doc, signedUrl: data?.signedUrl ?? null }
    })
  )

  return (
    <div className="p-8 max-w-4xl space-y-6">

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Documents
          {docsWithUrls.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-500">
              {docsWithUrls.length} file{docsWithUrls.length !== 1 ? 's' : ''}
            </span>
          )}
        </h2>
      </div>

      {visits.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Site Visits
          </h3>
          {visits.map((v) => {
            const parts: string[] = []
            if (v.hasJsa) parts.push('risk assessment')
            if (v.sitePhotoCount > 0) parts.push(`${v.sitePhotoCount} site photo${v.sitePhotoCount !== 1 ? 's' : ''}`)
            if (v.fieldnoteCount > 0) parts.push(`${v.fieldnoteCount} fieldnote${v.fieldnoteCount !== 1 ? 's' : ''}`)
            return (
              <Card key={v.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 shrink-0 rounded-md bg-amber-50 flex items-center justify-center">
                      <Camera className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {formatDate(v.date)}
                        {v.taskTitle && (
                          <span className="ml-2 font-normal text-slate-500">· {v.taskTitle}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{parts.join(' · ')}</p>
                    </div>
                  </div>
                  <a
                    href={`/api/projects/${jobNumber}/field-visits/${v.id}/zip`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 border border-blue-200 rounded-md whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download as ZIP
                  </a>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {docsWithUrls.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <FileText className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No documents yet.</p>
          <p className="text-xs text-slate-400 mt-1">Invoice PDFs are stored here automatically when invoices are created.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">File</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Size</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Uploaded</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docsWithUrls.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-slate-800 font-medium">{doc.file_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatBytes(doc.file_size_bytes)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatDate(doc.uploaded_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {doc.signedUrl ? (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
