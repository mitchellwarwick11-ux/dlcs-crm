import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import {
  ChevronLeft, MapPin, Clock, ShieldCheck, BookOpen, ListChecks,
  Camera, FileText, Timer, CheckCircle2, Circle, AlertCircle,
} from 'lucide-react'
import { SaveExitButton } from '@/components/field/save-exit-button'

export default async function JobHubPage({
  params,
}: {
  params: Promise<{ entryId: string }>
}) {
  const { entryId } = await params
  const supabase = await createClient()
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffProfile } = await db
    .from('staff_profiles')
    .select('id, full_name, role')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()

  if (!staffProfile) redirect('/field')

  const { data: entry } = await db
    .from('field_schedule_entries')
    .select(`
      id, date, hours, time_of_day, status, notes,
      brief_acknowledged_at,
      project_id, task_id,
      projects (
        id, job_number, job_type, site_address, suburb,
        clients ( name, company_name ),
        job_manager:staff_profiles!job_manager_id ( full_name, email )
      ),
      project_tasks ( id, title, task_definition_id ),
      office_surveyor:staff_profiles!office_surveyor_id ( full_name )
    `)
    .eq('id', entryId)
    .maybeSingle()

  if (!entry) notFound()

  const taskDefinitionId: string | null = entry.project_tasks?.task_definition_id ?? null

  // Parallel completion checks. Per the design:
  //   * Brief acknowledgement, JSA, Checklist, Photos, Fieldnotes are
  //     entry-level (one surveyor's completion covers both).
  //   * Time Log is per-staff (each surveyor logs their own hours).
  //   * Visit status row is per-staff (Save & Exit / Did-Not-Attend).
  const [
    { data: jsaAny },
    { data: timeLog },
    { count: photoCount },
    { count: notesCount },
    { data: checklistTpl },
    { data: visitStatus },
  ] = await Promise.all([
    db.from('jsa_submissions')
      .select('id, submitted_at')
      .eq('entry_id', entryId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    db.from('field_time_logs')
      .select('id, total_hours, is_overtime, start_time, end_time, notes, acting_role')
      .eq('entry_id', entryId)
      .eq('staff_id', staffProfile.id)
      .maybeSingle(),

    db.from('field_photos')
      .select('id', { count: 'exact', head: true })
      .eq('entry_id', entryId)
      .eq('type', 'site_photo'),

    db.from('field_photos')
      .select('id', { count: 'exact', head: true })
      .eq('entry_id', entryId)
      .eq('type', 'fieldbook_note'),

    taskDefinitionId
      ? db.from('checklist_templates')
          .select('id')
          .eq('is_active', true)
          .eq('task_definition_id', taskDefinitionId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    db.from('field_staff_visit_status')
      .select('saved_at, did_not_attend, dna_reason, submitted_at')
      .eq('entry_id', entryId)
      .eq('staff_id', staffProfile.id)
      .maybeSingle(),
  ])

  // Checklist completion: if a template exists for this task, look for any
  // surveyor's submitted submission on this entry.
  let checklistDone = !checklistTpl // no template -> auto-pass
  if (checklistTpl) {
    const { data: cs } = await db
      .from('checklist_submissions')
      .select('submitted_at')
      .eq('entry_id', entryId)
      .eq('template_id', checklistTpl.id)
      .not('submitted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    checklistDone = !!cs
  }

  const briefContent: string | null = (entry.notes ?? '').trim() || null
  const briefAcknowledged = !!entry.brief_acknowledged_at
  const jsaDone           = !!jsaAny
  const photosDone        = (photoCount ?? 0) > 0
  const notesDone         = (notesCount ?? 0) > 0
  const timeLogDone       = !!timeLog
  const isSaved           = !!visitStatus?.saved_at
  const didNotAttend      = !!visitStatus?.did_not_attend

  // Build blocker list for Save & Exit. (Skipped entirely if user can DNA.)
  const blockers: { label: string }[] = []
  if (!briefAcknowledged) blockers.push({ label: 'Acknowledge the Job Brief' })
  if (!jsaDone)           blockers.push({ label: 'Complete the Risk Assessment' })
  if (!checklistDone)     blockers.push({ label: 'Submit the Checklist' })
  if (!photosDone)        blockers.push({ label: 'Upload at least 1 site photo' })
  if (!notesDone)         blockers.push({ label: 'Upload at least 1 fieldbook page' })
  if (!timeLogDone)       blockers.push({ label: 'Record your Time Log' })

  const proj    = entry.projects
  const task    = entry.project_tasks
  const address = proj ? [proj.site_address, proj.suburb].filter(Boolean).join(', ') : null

  return (
    <div className="flex flex-col flex-1 bg-[#E8E5DC]">
      {/* Header â€” charcoal */}
      <div className="bg-[#1A1A1E] px-4 pt-safe-top">
        <div className="flex items-center gap-2 py-3">
          <Link href="/field" className="p-1.5 -ml-1.5 rounded-lg text-[#BDBDC0] hover:bg-[#45454B] transition-colors">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#F39200] font-bold tracking-[0.18em]">JOB HUB</p>
            <h1 className="text-base font-bold text-white truncate">
              {proj?.job_number ?? entryId.slice(0, 8)}
            </h1>
          </div>
        </div>

        <div className="pb-5 space-y-2">
          {task && (
            <p className="text-[20px] font-bold text-white leading-snug">{task.title}</p>
          )}
          <div className="flex items-center gap-4 flex-wrap text-[13px] text-[#D6D6D9]">
            {address && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#BDBDC0] shrink-0" />
                <span>{address}</span>
              </div>
            )}
            {entry.time_of_day && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#BDBDC0]" />
                <span>{entry.time_of_day.toUpperCase()}{entry.hours != null ? ` Â· ${entry.hours}h` : ''}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-[#9A9A9C]">
            {format(parseISO(entry.date), 'EEE d MMMM yyyy')}
            {entry.office_surveyor && ` Â· Office: ${entry.office_surveyor.full_name}`}
          </p>
        </div>
      </div>

      {/* Hub tiles */}
      <div className="flex-1 overflow-y-auto px-5 py-5 bg-[#E8E5DC]">
        <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-3">Actions</p>
        <div className="space-y-2.5">

          {/* Job Brief */}
          <HubTile
            href={`/field/${entryId}/brief`}
            icon={<BookOpen className="h-[22px] w-[22px]" />}
            iconBg="bg-[#FBF1D8] text-[#A86B0C]"
            accentColor="bg-[#F39200]"
            title="Job Brief"
            subtitle="Read the brief and acknowledge"
            status={briefAcknowledged ? 'done' : 'required'}
            statusLabel={
              briefAcknowledged
                ? 'Acknowledged'
                : (briefContent ? 'Brief available â€” please acknowledge' : 'No brief â€” please acknowledge')
            }
          />

          {/* Risk Assessment */}
          <HubTile
            href={`/field/${entryId}/safety`}
            icon={<ShieldCheck className="h-[22px] w-[22px]" />}
            iconBg="bg-[#F8E4E4] text-[#A31D1D]"
            accentColor="bg-[#A31D1D]"
            title="Risk Assessment"
            subtitle="Complete pre-start safety form"
            status={jsaDone ? 'done' : 'required'}
            statusLabel={
              jsaDone
                ? `Completed Â· ${format(parseISO(jsaAny.submitted_at), 'd MMM h:mm a')}`
                : 'Required before starting'
            }
          />

          {/* Checklist */}
          <HubTile
            href={`/field/${entryId}/checklist`}
            icon={<ListChecks className="h-[22px] w-[22px]" />}
            iconBg="bg-[#FFF1E0] text-[#C5670B]"
            accentColor="bg-[#F39200]"
            title="Checklist"
            subtitle={taskDefinitionId ? 'Task-specific checks' : 'No checklist for this task'}
            status={checklistDone ? 'done' : 'required'}
            statusLabel={
              !checklistTpl
                ? 'No checklist required'
                : (checklistDone ? 'Submitted' : 'Required â€” Yes/No on each item')
            }
          />

          {/* Site Photos */}
          <HubTile
            href={`/field/${entryId}/photos`}
            icon={<Camera className="h-[22px] w-[22px]" />}
            iconBg="bg-[#E7F3EC] text-[#1F7A3F]"
            accentColor="bg-[#1F7A3F]"
            title="Site Photos"
            subtitle="Capture and upload site images"
            status={photosDone ? 'done' : 'required'}
            statusLabel={photosDone ? `${photoCount} photo${photoCount === 1 ? '' : 's'} uploaded` : 'At least 1 required'}
          />

          {/* Fieldbook Notes */}
          <HubTile
            href={`/field/${entryId}/notes`}
            icon={<FileText className="h-[22px] w-[22px]" />}
            iconBg="bg-[#EFEDE6] text-[#6B6B6F]"
            accentColor="bg-[#D6D6D9]"
            title="Fieldbook Notes"
            subtitle="Photograph your fieldbook pages"
            status={notesDone ? 'done' : 'required'}
            statusLabel={notesDone ? `${notesCount} page${notesCount === 1 ? '' : 's'} uploaded` : 'At least 1 required'}
          />

          {/* Time Log */}
          <HubTile
            href={`/field/${entryId}/time`}
            icon={<Timer className="h-[22px] w-[22px]" />}
            iconBg="bg-[#E6EEF7] text-[#2257A3]"
            accentColor="bg-[#2257A3]"
            title="Time Log"
            subtitle="Record start, finish and breaks"
            status={timeLogDone ? 'done' : 'required'}
            statusLabel={
              timeLogDone
                ? `${timeLog!.total_hours}h logged${timeLog!.is_overtime ? ' Â· Overtime' : ''}`
                : 'Required'
            }
            overtime={timeLog?.is_overtime}
          />

        </div>

        {/* Save & Exit / DNA */}
        <div className="mt-6 pb-8">
          <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-3">Finish Job</p>
          <SaveExitButton
            entryId={entryId}
            staffId={staffProfile.id}
            blockers={blockers}
            savedAt={visitStatus?.saved_at ?? null}
            didNotAttend={didNotAttend}
            dnaReason={visitStatus?.dna_reason ?? null}
          />
          {!isSaved && (
            <p className="text-[11px] text-[#9A9A9C] text-center mt-3">
              Saving doesn&apos;t submit your hours yet â€” submit the day&apos;s work from the field schedule when you&apos;re done.
            </p>
          )}
        </div>

      </div>
    </div>
  )
}

function HubTile({
  href,
  icon,
  iconBg,
  accentColor,
  title,
  subtitle,
  status,
  statusLabel,
  overtime,
}: {
  href: string
  icon: React.ReactNode
  iconBg: string
  accentColor: string
  title: string
  subtitle: string
  status: 'done' | 'required' | 'pending' | 'available' | 'none'
  statusLabel: string
  overtime?: boolean
}) {
  const statusIcon =
    status === 'done'     ? <CheckCircle2 className="h-4 w-4 text-[#1F7A3F]" /> :
    status === 'required' ? <AlertCircle  className="h-4 w-4 text-[#A31D1D]" /> :
                            <Circle       className="h-4 w-4 text-[#BDBDC0]" />

  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 p-3.5 bg-white border border-[#D6D2C7] rounded-xl hover:border-[#F39200] transition-colors active:scale-[0.99]"
    >
      <div className={`w-[3px] h-11 rounded-sm shrink-0 ${accentColor}`} />
      <div className={`w-[42px] h-[42px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[#111111] text-sm">{title}</p>
        <p className="text-xs text-[#6B6B6F] mt-0.5">{subtitle}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {statusIcon}
          <span className={`text-xs ${
            overtime ? 'text-[#A86B0C] font-medium' :
            status === 'done' ? 'text-[#1F7A3F]' :
            status === 'required' ? 'text-[#A31D1D] font-medium' :
            'text-[#9A9A9C]'
          }`}>
            {statusLabel}
          </span>
        </div>
      </div>
      <ChevronLeft className="h-4 w-4 text-[#BDBDC0] rotate-180 shrink-0" />
    </Link>
  )
}
