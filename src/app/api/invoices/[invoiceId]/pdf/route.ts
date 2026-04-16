import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoicePDFDocument } from '@/components/invoices/invoice-pdf'
import type { TaskSection } from '@/components/invoices/invoice-pdf'

export const runtime = 'nodejs'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params
  const supabase = await createClient()
  const db = supabase as any

  // Fetch company settings
  const { data: settingsRows } = await db.from('company_settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of (settingsRows ?? [])) settings[row.key] = row.value

  // Fetch invoice
  const { data: invoice } = await db
    .from('invoices')
    .select(`
      invoice_number, created_at, due_date,
      subtotal, gst_amount, total, notes,
      projects ( id, title, clients ( name, company_name ) ),
      quotes ( contact_name, contact_email )
    `)
    .eq('id', invoiceId)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const inv = invoice as any

  // Fetch invoice items with task + time entry info
  const { data: items } = await db
    .from('invoice_items')
    .select(`
      id, description, quantity, unit_price, amount,
      task_id, time_entry_id, prev_claimed_amount, sort_order,
      project_tasks ( title, fee_type, quoted_amount ),
      time_entries ( date, hours, rate_at_time, staff_profiles ( full_name ) )
    `)
    .eq('invoice_id', invoiceId)
    .order('sort_order')

  const itemList = (items ?? []) as any[]

  // Group items into task sections (preserving order)
  const sectionsMap = new Map<string, TaskSection>()
  for (const item of itemList) {
    const key      = item.task_id ?? `no-task-${item.id}`
    const feeType  = item.project_tasks?.fee_type ?? 'fixed'
    const taskTitle = item.project_tasks?.title ?? item.description

    if (!sectionsMap.has(key)) {
      const quotedAmount = item.project_tasks?.quoted_amount ?? 0
      const prevClaimed  = item.prev_claimed_amount ?? 0
      const thisClaim    = feeType === 'fixed' ? (item.amount ?? item.unit_price) : 0
      const remaining    = quotedAmount - prevClaimed - thisClaim
      const claimLabel   = feeType === 'fixed'
        ? (remaining <= 0.005 ? 'Final Claim' : 'Progress Claim')
        : undefined

      sectionsMap.set(key, {
        taskId: key,
        taskTitle,
        feeType,
        claimLabel,
        quotedAmount,
        prevClaimed,
        thisClaim,
        entries: [],
      })
    }

    const section = sectionsMap.get(key)!
    if (feeType === 'hourly' && item.time_entries) {
      const te = item.time_entries as any
      section.entries!.push({
        date: te.date,
        staffName: te.staff_profiles?.full_name ?? '—',
        description: item.description,
        hours: item.quantity,
        rate: item.unit_price,
        amount: item.amount,
      })
    }
  }

  const taskSections = Array.from(sectionsMap.values())

  // Build PDF props
  const pdfProps = {
    invoiceNumber: inv.invoice_number,
    createdAt: inv.created_at,
    dueDate: inv.due_date,
    subtotal: inv.subtotal,
    gstAmount: inv.gst_amount,
    total: inv.total,
    notes: inv.notes,
    contactName: inv.quotes?.contact_name ?? null,
    contactEmail: inv.quotes?.contact_email ?? null,
    projectTitle: inv.projects?.title ?? '',
    clientName: inv.projects?.clients?.company_name ?? inv.projects?.clients?.name ?? null,
    taskSections,
    companyName: settings.company_name || 'Delfs Lascelles Consulting Surveyors',
    abn: settings.abn || '',
    bankName: settings.bank_name || '',
    bsb: settings.bsb || '',
    accountNumber: settings.account_number || '',
    accountName: settings.account_name || '',
  }

  // Render PDF
  const element = React.createElement(InvoicePDFDocument, pdfProps) as any
  const buffer  = await renderToBuffer(element)

  // Upload to Supabase Storage
  const projectId   = inv.projects?.id
  const fileName    = `${inv.invoice_number}.pdf`
  const storagePath = `${projectId}/${fileName}`

  const { error: uploadErr } = await supabase.storage
    .from('project-documents')
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

  if (!uploadErr && projectId) {
    const { data: { user } } = await supabase.auth.getUser()

    // Remove old document record if it exists (re-generated PDF)
    await db.from('documents').delete()
      .eq('project_id', projectId)
      .eq('file_path', storagePath)

    await db.from('documents').insert({
      project_id: projectId,
      file_name: fileName,
      file_path: storagePath,
      file_size_bytes: buffer.length,
      mime_type: 'application/pdf',
      uploaded_by: user?.id ?? null,
    })
  }

  return NextResponse.json({ success: true, path: uploadErr ? null : storagePath })
}
