import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import {
  RiskAssessmentPDFDocument,
  type SignatoryRow,
  type AdditionalHazardRow,
} from '@/components/field/risk-assessment-pdf'
import { isValidRating } from '@/components/field/risk-matrix'

export const runtime = 'nodejs'

function normaliseHazardsForPdf(raw: unknown): AdditionalHazardRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item: any) => ({
    procedure:          typeof item?.procedure === 'string' ? item.procedure : '',
    hazard:             typeof item?.hazard === 'string' ? item.hazard : '',
    risk:               isValidRating(item?.risk) ? item.risk : null,
    control_measures:   typeof item?.control_measures === 'string' ? item.control_measures : '',
    residual:           isValidRating(item?.residual) ? item.residual : null,
    person_responsible: typeof item?.person_responsible === 'string' ? item.person_responsible : '',
  }))
}

const ROLE_LABELS: Record<string, string> = {
  field_surveyor:       'Field Surveyor',
  office_surveyor:      'Office Surveyor',
  registered_surveyor:  'Registered Surveyor',
  administration:       'Administration',
  drafting:             'Drafting',
  sewer_water_designer: 'Sewer & Water Designer',
}

/**
 * Render a Risk Assessment PDF for every JSA submission attached to a field
 * schedule entry (one PDF per entry, signatories table includes every surveyor
 * who signed off), upload to Supabase Storage, and register a row in the
 * `documents` table so it shows up on the project's Documents page.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const { entryId } = await params
  const supabase = await createClient()
  const db = supabase as any

  // Entry → project + scheduled task title
  const { data: entry } = await db
    .from('field_schedule_entries')
    .select(`
      id,
      project_tasks ( title ),
      projects (
        id, job_number, title, site_address, suburb,
        job_manager:job_manager_id ( full_name )
      )
    `)
    .eq('id', entryId)
    .maybeSingle()

  if (!entry || !entry.projects?.id) {
    return NextResponse.json({ error: 'Entry or project not found' }, { status: 404 })
  }

  // All JSA submissions for this entry — one row per surveyor who signed
  const { data: subs } = await db
    .from('jsa_submissions')
    .select(`
      id, specific_swms_required, selected_tasks, additional_hazards,
      signature_data, submitted_at,
      staff_profiles!staff_id ( full_name, role )
    `)
    .eq('entry_id', entryId)
    .order('submitted_at', { ascending: true })

  const submissions = (subs ?? []) as any[]
  if (submissions.length === 0) {
    return NextResponse.json({ error: 'No JSA submissions found for this entry' }, { status: 404 })
  }

  // The latest submission's selections drive the page-1 task ticks / additional
  // hazards box; the signatories table aggregates everyone who signed.
  const latest = submissions[submissions.length - 1]

  const project = entry.projects
  const taskTitle = entry.project_tasks?.title ?? ''

  const siteSpecific = [project.site_address, project.suburb]
    .filter((v: string | null | undefined) => v && String(v).trim())
    .join(', ')

  const signatories: SignatoryRow[] = submissions.map((s: any) => ({
    surveyingTask:    taskTitle,
    name:             s.staff_profiles?.full_name ?? '',
    position:         ROLE_LABELS[s.staff_profiles?.role] ?? s.staff_profiles?.role ?? '',
    signatureDataUrl: s.signature_data ?? null,
  }))

  const pdfProps = {
    jobNumber:            project.job_number,
    siteSpecific:         siteSpecific || project.title,
    managerName:          project.job_manager?.full_name ?? '',
    specificSwmsRequired: !!latest.specific_swms_required,
    selectedTasks:        latest.selected_tasks ?? [],
    additionalHazards:    normaliseHazardsForPdf(latest.additional_hazards),
    signatories,
    generatedAt:          new Date().toISOString(),
  }

  const element = React.createElement(RiskAssessmentPDFDocument, pdfProps) as any
  const buffer  = await renderToBuffer(element)

  // Upload to storage
  const fileName    = `risk-assessment-${project.job_number}-${entryId.slice(0, 8)}.pdf`
  const storagePath = `${project.id}/${fileName}`

  const { error: uploadErr } = await supabase.storage
    .from('project-documents')
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

  if (uploadErr) {
    return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
  }

  // Replace any prior documents row pointing at the same path so re-submits
  // don't pile up duplicate entries on the Documents page.
  await db.from('documents').delete()
    .eq('project_id', project.id)
    .eq('file_path', storagePath)

  const { data: { user } } = await supabase.auth.getUser()
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
