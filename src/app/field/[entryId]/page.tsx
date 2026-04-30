import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import {
  ChevronLeft, MapPin, Clock, ShieldCheck, BookOpen,
  Camera, FileText, Timer, CheckCircle2, Circle, AlertCircle,
} from 'lucide-react'
import { SubmitJobButton } from '@/components/field/submit-job-button'

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

  // Fetch the schedule entry
  const { data: entry } = await db
    .from('field_schedule_entries')
    .select(`
      id, date, hours, time_of_day, status, notes,
      project_id, task_id,
      projects (
        id, job_number, job_type, site_address, suburb,
        clients ( name, company_name ),
        job_manager:staff_profiles!job_manager_id ( full_name, email )
      ),
      project_tasks ( id, title ),
      office_surveyor:staff_profiles!office_surveyor_id ( full_name )
    `)
    .eq('id', entryId)
    .maybeSingle()

  if (!entry) notFound()

  // Parallel completion checks
  const [
    { data: jsa },
    { data: timeLog },
    { count: photoCount },
    { count: notesCount },
    { data: brief },
  ] = await Promise.all([
    db.from('jsa_submissions')
      .select('id, submitted_at')
      .eq('entry_id', entryId)
      .eq('staff_id', staffProfile.id)
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

    db.from('job_briefs')
      .select('id, content')
      .eq('project_id', entry.project_id)
      .maybeSingle(),
  ])

  const proj    = entry.projects
  const task    = entry.project_tasks
  const address = proj ? [proj.site_address, proj.suburb].filter(Boolean).join(', ') : null

  return (
    <div className="flex flex-col flex-1 bg-[#F5F4F1]">
      {/* Header — charcoal */}
      <div className="bg-[#2F2F33] px-4 pt-safe-top">
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

        {/* Job details strip */}
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
                <span>{entry.time_of_day.toUpperCase()}{entry.hours != null ? ` · ${entry.hours}h` : ''}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-[#9A9A9C]">
            {format(parseISO(entry.date), 'EEE d MMMM yyyy')}
            {entry.office_surveyor && ` · Office: ${entry.office_surveyor.full_name}`}
          </p>
        </div>
      </div>

      {/* Hub tiles */}
      <div className="flex-1 overflow-y-auto px-5 py-5 bg-[#F5F4F1]">
        <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-3">Actions</p>
        <div className="space-y-2.5">

          {/* Safety / JSA */}
          <HubTile
            href={`/field/${entryId}/safety`}
            icon={<ShieldCheck className="h-[22px] w-[22px]" />}
            iconBg="bg-[#F8E4E4] text-[#A31D1D]"
            accentColor="bg-[#A31D1D]"
            title="Risk Assessment"
            subtitle="Complete pre-start safety form"
            status={jsa ? 'done' : 'required'}
            statusLabel={jsa ? `Completed · ${format(parseISO(jsa.submitted_at), 'd MMM h:mm a')}` : 'Required before starting'}
          />

          {/* Job Brief */}
          <HubTile
            href={`/field/${entryId}/brief`}
            icon={<BookOpen className="h-[22px] w-[22px]" />}
            iconBg="bg-[#FBF1D8] text-[#A86B0C]"
            accentColor="bg-[#F39200]"
            title="Job Brief & Checklists"
            subtitle="Instructions and equipment checklist"
            status={brief ? 'available' : 'none'}
            statusLabel={brief ? 'Brief available' : 'No brief provided'}
          />

          {/* Site Photos */}
          <HubTile
            href={`/field/${entryId}/photos`}
            icon={<Camera className="h-[22px] w-[22px]" />}
            iconBg="bg-[#E7F3EC] text-[#1F7A3F]"
            accentColor="bg-[#1F7A3F]"
            title="Site Photos"
            subtitle="Capture and upload site images"
            status={(photoCount ?? 0) > 0 ? 'done' : 'pending'}
            statusLabel={(photoCount ?? 0) > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'} uploaded` : 'No photos yet'}
          />

          {/* Fieldbook Notes */}
          <HubTile
            href={`/field/${entryId}/notes`}
            icon={<FileText className="h-[22px] w-[22px]" />}
            iconBg="bg-[#EFEDE6] text-[#6B6B6F]"
            accentColor="bg-[#D6D6D9]"
            title="Fieldbook Notes"
            subtitle="Photograph your fieldbook pages"
            status={(notesCount ?? 0) > 0 ? 'done' : 'pending'}
            statusLabel={(notesCount ?? 0) > 0 ? `${notesCount} page${notesCount === 1 ? '' : 's'} uploaded` : 'No pages uploaded'}
          />

          {/* Time Log */}
          <HubTile
            href={`/field/${entryId}/time`}
            icon={<Timer className="h-[22px] w-[22px]" />}
            iconBg="bg-[#E6EEF7] text-[#2257A3]"
            accentColor="bg-[#2257A3]"
            title="Time Log"
            subtitle="Record start, finish and breaks"
            status={timeLog ? 'done' : 'pending'}
            statusLabel={
              timeLog
                ? `${timeLog.total_hours}h logged${timeLog.is_overtime ? ' · Overtime' : ''}`
                : 'Not yet submitted'
            }
            overtime={timeLog?.is_overtime}
          />

        </div>

        {/* Notes from entry */}
        {entry.notes && (
          <div className="mt-5 flex gap-3 p-3.5 bg-[#FAF8F3] border border-[#EFEDE6] rounded-xl">
            <div className="w-[3px] bg-[#F39200] shrink-0 rounded-full" />
            <div className="flex-1">
              <p className="text-[10px] font-bold text-[#F39200] tracking-[0.18em] mb-1">PM NOTES</p>
              <p className="text-sm text-[#4B4B4F] whitespace-pre-wrap leading-relaxed">{entry.notes}</p>
            </div>
          </div>
        )}

        {/* Submit button */}
        <div className="mt-6 pb-8">
          <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-3">End of Day</p>
          <SubmitJobButton
            entryId={entryId}
            projectId={entry.project_id}
            taskId={entry.task_id ?? null}
            taskTitle={task?.title ?? null}
            staffId={staffProfile.id}
            staffRole={(staffProfile as any).role ?? ''}
            actingRole={(timeLog as any)?.acting_role ?? null}
            workDate={entry.date}
            timeLogId={timeLog?.id ?? null}
            timeEntryId={null}
            timeLogNotes={timeLog?.notes ?? null}
            totalHours={timeLog?.total_hours ?? null}
            isOvertime={timeLog?.is_overtime ?? false}
            jsaDone={!!jsa}
            alreadyComplete={entry.status === 'completed'}
          />
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
      className="flex items-center gap-3.5 p-3.5 bg-white border border-[#E8E6E0] rounded-xl hover:border-[#F39200] transition-colors active:scale-[0.99]"
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
