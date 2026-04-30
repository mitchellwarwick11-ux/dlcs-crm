import { NextRequest } from 'next/server'
import { Readable } from 'node:stream'
import archiver from 'archiver'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string, entryId: string }> }
) {
  const { jobNumber, entryId } = await params
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

  const { data: entry } = await db
    .from('field_schedule_entries')
    .select('id, date, project_id')
    .eq('id', entryId)
    .maybeSingle()
  if (!entry || entry.project_id !== project.id) {
    return new Response('Field visit not found', { status: 404 })
  }

  const { data: photos } = await db
    .from('field_photos')
    .select('id, storage_path, type, uploaded_at')
    .eq('entry_id', entryId)
    .order('uploaded_at', { ascending: true })

  const photoList = (photos ?? []) as any[]

  // The JSA PDF is stored in the `documents` table with the entry id's first 8
  // chars in the file path (see /api/jsa/[entryId]/pdf/route.ts).
  const entryIdShort = entryId.slice(0, 8)
  const { data: jsaDocs } = await db
    .from('documents')
    .select('id, file_name, file_path')
    .eq('project_id', project.id)
    .ilike('file_path', `%risk-assessment%${entryIdShort}%`)

  const jsa = (jsaDocs ?? [])[0] as { file_name: string, file_path: string } | undefined

  if (photoList.length === 0 && !jsa) {
    return new Response('No artifacts for this field visit', { status: 404 })
  }

  const archive = archiver('zip', { zlib: { level: 6 } })

  ;(async () => {
    if (jsa) {
      try {
        const { data } = await supabase.storage
          .from('project-documents')
          .download(jsa.file_path)
        if (data) {
          const buf = Buffer.from(await data.arrayBuffer())
          archive.append(buf, { name: 'risk-assessment.pdf' })
        }
      } catch {
        // skip — rest of zip still completes
      }
    }

    const usedNames = new Set<string>()
    for (const p of photoList) {
      try {
        const { data } = await supabase.storage
          .from('field-photos')
          .download(p.storage_path)
        if (!data) continue

        const buf = Buffer.from(await data.arrayBuffer())
        const folder = p.type === 'fieldbook_note' ? 'fieldnotes' : 'site-photos'
        const baseName = (p.storage_path.split('/').pop() ?? `${p.id}.jpg`)
          .replace(/[^A-Za-z0-9._-]/g, '_')

        let name = `${folder}/${baseName}`
        let counter = 1
        while (usedNames.has(name)) {
          const dot = baseName.lastIndexOf('.')
          const stem = dot === -1 ? baseName : baseName.slice(0, dot)
          const ext  = dot === -1 ? ''       : baseName.slice(dot)
          name = `${folder}/${stem}-${counter}${ext}`
          counter++
        }
        usedNames.add(name)
        archive.append(buf, { name })
      } catch {
        // skip individual file failures
      }
    }

    archive.finalize()
  })()

  const filename = `${jobNumber}-${entry.date}-field-visit.zip`
  return new Response(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
