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

  const { data: sitePhotos } = await db
    .from('field_photos')
    .select('id, field_schedule_entries ( date )')
    .eq('project_id', (project as any).id)
    .eq('type', 'site_photo')

  const sitePhotoList = (sitePhotos ?? []) as any[]
  const sitePhotoCount = sitePhotoList.length
  const sitePhotoVisitCount = new Set(
    sitePhotoList.map((p) => p.field_schedule_entries?.date).filter(Boolean)
  ).size

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

      {sitePhotoCount > 0 && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-md bg-amber-50 flex items-center justify-center">
                <Camera className="h-4 w-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">Site Photos</p>
                <p className="text-xs text-slate-500">
                  {sitePhotoCount} photo{sitePhotoCount !== 1 ? 's' : ''}
                  {sitePhotoVisitCount > 0 && (
                    <> across {sitePhotoVisitCount} site visit{sitePhotoVisitCount !== 1 ? 's' : ''}</>
                  )}
                </p>
              </div>
            </div>
            <a
              href={`/api/projects/${jobNumber}/site-photos.zip`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 border border-blue-200 rounded-md whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Download all as ZIP
            </a>
          </CardContent>
        </Card>
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
