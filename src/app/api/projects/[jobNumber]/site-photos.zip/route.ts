import { NextRequest } from 'next/server'
import { Readable } from 'node:stream'
import archiver from 'archiver'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> }
) {
  const { jobNumber } = await params
  const supabase = await createClient()
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: project } = await db
    .from('projects')
    .select('id, job_number')
    .eq('job_number', jobNumber)
    .maybeSingle()

  if (!project) return new Response('Project not found', { status: 404 })

  const { data: photos } = await db
    .from('field_photos')
    .select('id, storage_path, uploaded_at, field_schedule_entries ( date )')
    .eq('project_id', project.id)
    .eq('type', 'site_photo')
    .order('uploaded_at', { ascending: true })

  const photoList = (photos ?? []) as any[]
  if (photoList.length === 0) {
    return new Response('No site photos for this job', { status: 404 })
  }

  const archive = archiver('zip', { zlib: { level: 6 } })

  // Background pump — runs while the response is already streaming to the client
  ;(async () => {
    const usedNames = new Set<string>()

    for (const p of photoList) {
      try {
        const { data } = await supabase.storage
          .from('field-photos')
          .download(p.storage_path)
        if (!data) continue

        const buf = Buffer.from(await data.arrayBuffer())
        const date = p.field_schedule_entries?.date ?? 'undated'
        const baseName = (p.storage_path.split('/').pop() ?? `${p.id}.jpg`).replace(/[^A-Za-z0-9._-]/g, '_')

        let name = `${date}/${baseName}`
        let counter = 1
        while (usedNames.has(name)) {
          const dot = baseName.lastIndexOf('.')
          const stem = dot === -1 ? baseName : baseName.slice(0, dot)
          const ext  = dot === -1 ? ''       : baseName.slice(dot)
          name = `${date}/${stem}-${counter}${ext}`
          counter++
        }
        usedNames.add(name)

        archive.append(buf, { name })
      } catch {
        // skip individual file failures so the rest of the zip still completes
      }
    }
    archive.finalize()
  })()

  const filename = `${jobNumber}-site-photos.zip`
  return new Response(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
