import { redirect } from 'next/navigation'
import { startOfWeek, addDays, format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { FieldScheduleBoard } from '@/components/fieldwork/field-schedule-board'
import type { ScheduleEntryFull } from '@/types/database'

export default async function FieldworkPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any
  const sp = await searchParams

  // Determine the two-week window
  const weekStart = sp.week
    ? parseISO(sp.week)
    : startOfWeek(new Date(), { weekStartsOn: 1 })
  const windowStart = format(weekStart, 'yyyy-MM-dd')
  const windowEnd   = format(addDays(weekStart, 13), 'yyyy-MM-dd')

  // Determine canEdit from viewer's access_level
  const { data: myProfile } = await db
    .from('staff_profiles')
    .select('access_level')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()

  const canEdit = myProfile?.access_level === 'project_manager'
    || myProfile?.access_level === 'admin'

  // Parallel data fetches
  const [
    { data: rawEntries },
    { data: surveyorLinks },
    { data: resourceLinks },
    { data: projectsData },
    { data: fieldSurveyorsData },
    { data: officeSurveyorsData },
    { data: tasksData },
    { data: equipmentData },
    { data: allStaffData },
  ] = await Promise.all([
    db.from('field_schedule_entries')
      .select(`
        id, date, hours, time_of_day, status, notes, task_id, office_surveyor_id,
        project_id,
        projects (
          id, job_number, site_address, suburb,
          clients ( name, company_name ),
          job_manager:staff_profiles!job_manager_id ( id, full_name )
        ),
        project_tasks ( id, title, due_date ),
        office_surveyor:staff_profiles!office_surveyor_id ( id, full_name ),
        created_by, created_at, updated_at
      `)
      .gte('date', windowStart)
      .lte('date', windowEnd)
      .order('date')
      .order('created_at'),

    db.from('field_schedule_surveyors')
      .select('entry_id, staff_profiles ( id, full_name )'),

    db.from('field_schedule_resources')
      .select('entry_id, schedule_equipment ( id, label )'),

    db.from('projects')
      .select(`
        id, job_number, title, site_address, suburb,
        clients ( name, company_name ),
        job_manager:staff_profiles!job_manager_id ( full_name )
      `)
      .in('status', ['active', 'on_hold'])
      .order('job_number', { ascending: false }),

    db.from('staff_profiles')
      .select('id, full_name')
      .eq('role', 'field_surveyor')
      .eq('is_active', true)
      .order('full_name'),

    db.from('staff_profiles')
      .select('id, full_name')
      .in('role', ['office_surveyor', 'registered_surveyor'])
      .eq('is_active', true)
      .order('full_name'),

    db.from('project_tasks')
      .select('id, project_id, title')
      .not('status', 'in', '("completed","cancelled")')
      .order('title'),

    db.from('schedule_equipment')
      .select('id, label')
      .eq('is_active', true)
      .order('sort_order'),

    db.from('staff_profiles')
      .select('id, full_name, role')
      .eq('is_active', true)
      .order('full_name'),
  ])

  // Build maps for junction data
  const surveyorMap = new Map<string, { id: string; full_name: string }[]>()
  for (const link of (surveyorLinks ?? [])) {
    const sp = link.staff_profiles as any
    if (!sp) continue
    if (!surveyorMap.has(link.entry_id)) surveyorMap.set(link.entry_id, [])
    surveyorMap.get(link.entry_id)!.push({ id: sp.id, full_name: sp.full_name })
  }

  const resourceMap = new Map<string, { id: string; label: string }[]>()
  for (const link of (resourceLinks ?? [])) {
    const eq = link.schedule_equipment as any
    if (!eq) continue
    if (!resourceMap.has(link.entry_id)) resourceMap.set(link.entry_id, [])
    resourceMap.get(link.entry_id)!.push({ id: eq.id, label: eq.label })
  }

  // Merge into enriched entries
  const entries: ScheduleEntryFull[] = (rawEntries ?? []).map((e: any) => ({
    ...e,
    field_surveyors: surveyorMap.get(e.id) ?? [],
    resources:       resourceMap.get(e.id) ?? [],
  }))

  return (
    <FieldScheduleBoard
      initialEntries={entries}
      weekStart={windowStart}
      canEdit={canEdit}
      projects={(projectsData ?? []) as any[]}
      fieldSurveyors={fieldSurveyorsData ?? []}
      officeSurveyors={officeSurveyorsData ?? []}
      allTasks={tasksData ?? []}
      equipment={equipmentData ?? []}
      allStaff={allStaffData ?? []}
    />
  )
}
