import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * End-of-day batch submission for the authenticated surveyor.
 *
 * Looks at every entry on `date` (YYYY-MM-DD; defaults to today) where this
 * surveyor's field_staff_visit_status row is saved but not yet submitted, and:
 *   * For attended entries — posts/updates a time_entry against the project
 *     (mirrors submit-job-button.tsx logic) and marks the field_schedule_entry
 *     as completed.
 *   * For DNA entries — leaves the schedule entry status alone (the PM can
 *     decide whether to cancel/reschedule), and posts no hours.
 *   * Always sets visit_status.submitted_at so the row is locked.
 *
 * Returns counts of attended / dna / failed entries.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staffProfile } = await db
    .from('staff_profiles')
    .select('id, role')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()
  if (!staffProfile) return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const date: string = (body?.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date))
    ? body.date
    : format(new Date(), 'yyyy-MM-dd')

  // Find this surveyor's saved-but-unsubmitted entries on this date.
  const { data: links } = await db
    .from('field_schedule_surveyors')
    .select('entry_id')
    .eq('staff_id', staffProfile.id)
  const linkedIds: string[] = (links ?? []).map((l: any) => l.entry_id)
  if (linkedIds.length === 0) {
    return NextResponse.json({ attended: 0, dna: 0, failed: 0, total: 0, errors: [] })
  }

  const { data: entriesToday } = await db
    .from('field_schedule_entries')
    .select('id, project_id, task_id, date')
    .in('id', linkedIds)
    .eq('date', date)
  const todaysEntryIds: string[] = (entriesToday ?? []).map((e: any) => e.id)
  if (todaysEntryIds.length === 0) {
    return NextResponse.json({ attended: 0, dna: 0, failed: 0, total: 0, errors: [] })
  }

  const { data: visitStatuses } = await db
    .from('field_staff_visit_status')
    .select('entry_id, saved_at, submitted_at, did_not_attend')
    .in('entry_id', todaysEntryIds)
    .eq('staff_id', staffProfile.id)

  const readyStatuses = (visitStatuses ?? []).filter(
    (vs: any) => !!vs.saved_at && !vs.submitted_at
  )
  if (readyStatuses.length === 0) {
    return NextResponse.json({ attended: 0, dna: 0, failed: 0, total: 0, errors: [] })
  }

  let attended = 0
  let dna      = 0
  let failed   = 0
  const errors: { entry_id: string; reason: string }[] = []
  const now = new Date().toISOString()

  for (const vs of readyStatuses) {
    const entry = (entriesToday ?? []).find((e: any) => e.id === vs.entry_id)
    if (!entry) {
      failed++
      errors.push({ entry_id: vs.entry_id, reason: 'Schedule entry missing' })
      continue
    }

    try {
      if (vs.did_not_attend) {
        // No hours, no entry-status change. Just mark submitted.
        await db.from('field_staff_visit_status')
          .update({ submitted_at: now, updated_at: now })
          .eq('entry_id', entry.id)
          .eq('staff_id', staffProfile.id)
        dna++
        continue
      }

      // Attended path — pull the time log + acting_role
      const { data: timeLog } = await db
        .from('field_time_logs')
        .select('id, total_hours, notes, acting_role')
        .eq('entry_id', entry.id)
        .eq('staff_id', staffProfile.id)
        .maybeSingle()

      if (!timeLog || !timeLog.total_hours) {
        failed++
        errors.push({ entry_id: entry.id, reason: 'No time log recorded' })
        continue
      }

      const billingRole = timeLog.acting_role || staffProfile.role || ''

      // Resolve rate: project override → role default → 0
      let rate = 0
      if (billingRole) {
        const { data: projRate } = await db
          .from('project_role_rates')
          .select('hourly_rate')
          .eq('project_id', entry.project_id)
          .eq('role_key', billingRole)
          .maybeSingle()

        if (projRate) {
          rate = projRate.hourly_rate
        } else {
          const { data: roleRate } = await db
            .from('role_rates')
            .select('hourly_rate')
            .eq('role_key', billingRole)
            .maybeSingle()
          if (roleRate) rate = roleRate.hourly_rate
        }
      }

      const actingRoleToSave =
        timeLog.acting_role && timeLog.acting_role !== staffProfile.role
          ? timeLog.acting_role
          : null
      const description = timeLog.notes?.trim() || null

      // Find existing time_entry for this project/staff/date (re-submit safety)
      let existingEntry: { id: string } | null = null
      if (entry.task_id) {
        const { data } = await db
          .from('time_entries')
          .select('id')
          .eq('project_id', entry.project_id)
          .eq('staff_id',   staffProfile.id)
          .eq('date',       entry.date)
          .eq('task_id',    entry.task_id)
          .maybeSingle()
        existingEntry = data
      }
      if (!existingEntry) {
        const { data } = await db
          .from('time_entries')
          .select('id')
          .eq('project_id', entry.project_id)
          .eq('staff_id',   staffProfile.id)
          .eq('date',       entry.date)
          .ilike('description', 'Field work%')
          .maybeSingle()
        existingEntry = data
      }

      if (existingEntry) {
        await db.from('time_entries')
          .update({
            hours:        timeLog.total_hours,
            rate_at_time: rate,
            description,
            task_id:      entry.task_id ?? null,
            acting_role:  actingRoleToSave,
            updated_at:   now,
          })
          .eq('id', existingEntry.id)
      } else {
        const { data: newEntry, error: insertErr } = await db
          .from('time_entries')
          .insert({
            project_id:   entry.project_id,
            staff_id:     staffProfile.id,
            date:         entry.date,
            hours:        timeLog.total_hours,
            description,
            task_id:      entry.task_id ?? null,
            is_billable:  true,
            rate_at_time: rate,
            acting_role:  actingRoleToSave,
          })
          .select('id')
          .single()
        if (insertErr || !newEntry) {
          failed++
          errors.push({ entry_id: entry.id, reason: 'Failed to post hours' })
          continue
        }
        if (timeLog.id) {
          await db.from('field_time_logs')
            .update({ time_entry_id: newEntry.id })
            .eq('id', timeLog.id)
        }
      }

      // Mark schedule entry completed
      await db.from('field_schedule_entries')
        .update({ status: 'completed' })
        .eq('id', entry.id)

      // Mark visit_status submitted
      await db.from('field_staff_visit_status')
        .update({ submitted_at: now, updated_at: now })
        .eq('entry_id', entry.id)
        .eq('staff_id', staffProfile.id)

      attended++
    } catch (e: any) {
      failed++
      errors.push({ entry_id: vs.entry_id, reason: e?.message ?? 'Unexpected error' })
    }
  }

  return NextResponse.json({
    attended,
    dna,
    failed,
    total: readyStatuses.length,
    errors,
  })
}
