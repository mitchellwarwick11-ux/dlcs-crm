import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { ChecklistPDFDocument, type ChecklistPDFItem } from '@/components/field/checklist-pdf'

export const runtime = 'nodejs'

interface ChecklistItem {
  id: string
  text: string
}

interface ChecklistResponse {
  item_id: string
  answer: 'yes' | 'no' | null
  comment: string
}

/**
 * Render a Checklist PDF for a surveyor's submission and drop it on the
 * project's Documents page (mirrors the Risk Assessment flow).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string; templateId: string }> },
) {
  const { entryId, templateId } = await params
  const supabase = await createClient()
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Staff profile of submitter
  const { data: staffProfile } = await db
    .from('staff_profiles')
    .select('id, full_name')
    .eq('email', user.email)
    .maybeSingle()
  if (!staffProfile) return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })

  // Entry → project + scheduled task title
  const { data: entry } = await db
    .from('field_schedule_entries')
    .select(`
      id, date,
      project_tasks ( title ),
      projects ( id, job_number, title, site_address, suburb )
    `)
    .eq('id', entryId)
    .maybeSingle()
  if (!entry || !entry.projects?.id) {
    return NextResponse.json({ error: 'Entry or project not found' }, { status: 404 })
  }

  // Checklist template
  const { data: template } = await db
    .from('checklist_templates')
    .select('id, title, items')
    .eq('id', templateId)
    .maybeSingle()
  if (!template) return NextResponse.json({ error: 'Checklist template not found' }, { status: 404 })

  // Surveyor's submission (responses)
  const { data: submission } = await db
    .from('checklist_submissions')
    .select('responses')
    .eq('entry_id', entryId)
    .eq('staff_id', staffProfile.id)
    .eq('template_id', templateId)
    .maybeSingle()

  const responses: ChecklistResponse[] = Array.isArray(submission?.responses)
    ? (submission.responses as ChecklistResponse[])
    : []
  const responsesById = new Map<string, ChecklistResponse>(responses.map(r => [r.item_id, r]))

  const project = entry.projects
  const taskTitle = entry.project_tasks?.title ?? ''
  const siteSpecific = [project.site_address, project.suburb]
    .filter((v: string | null | undefined) => v && String(v).trim())
    .join(', ')

  const templateItems: ChecklistItem[] = Array.isArray(template.items) ? template.items : []
  const pdfItems: ChecklistPDFItem[] = templateItems.map((it: ChecklistItem) => {
    const r = responsesById.get(it.id)
    return {
      text:    it.text,
      answer:  r?.answer === 'yes' || r?.answer === 'no' ? r.answer : null,
      comment: r?.comment ?? '',
    }
  })

  const pdfProps = {
    jobNumber:     project.job_number,
    siteSpecific:  siteSpecific || project.title,
    taskTitle,
    surveyorName:  staffProfile.full_name ?? '',
    templateTitle: template.title,
    items:         pdfItems,
    visitDate:     entry.date,
    generatedAt:   new Date().toISOString(),
  }

  const element = React.createElement(ChecklistPDFDocument, pdfProps) as any
  const buffer  = await renderToBuffer(element)

  // Upload to storage. Include staff id short in path so multiple surveyors
  // on the same entry don't overwrite each other.
  const safeTitle = template.title.replace(/[^A-Za-z0-9._-]+/g, '-').toLowerCase()
  const fileName = `checklist-${safeTitle}-${project.job_number}-${entryId.slice(0, 8)}-${staffProfile.id.slice(0, 8)}.pdf`
  const storagePath = `${project.id}/${fileName}`

  const { error: uploadErr } = await supabase.storage
    .from('project-documents')
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

  if (uploadErr) {
    return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
  }

  // Replace any prior documents row pointing at the same path so re-submits
  // don't pile up duplicates.
  await db.from('documents').delete()
    .eq('project_id', project.id)
    .eq('file_path', storagePath)

  await db.from('documents').insert({
    project_id:      project.id,
    file_name:       fileName,
    file_path:       storagePath,
    file_size_bytes: buffer.length,
    mime_type:       'application/pdf',
    uploaded_by:     user?.id ?? null,
  })

  return NextResponse.json({ success: true, path: storagePath, fileName })
}
