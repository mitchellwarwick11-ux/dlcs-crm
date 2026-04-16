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
      .select('id, total_hours, is_overtime, start_time, end_time, notes')
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
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-safe-top pb-0">
        <div className="flex items-center gap-2 py-3">
          <Link href="/field" className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Job Hub</p>
            <h1 className="text-base font-bold text-slate-900 truncate">
              {proj?.job_number ?? entryId.slice(0, 8)}
              {task && <span className="font-normal text-slate-500"> · {task.title}</span>}
            </h1>
          </div>
        </div>

        {/* Job details strip */}
        <div className="pb-4 space-y-1.5">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-semibold text-slate-700">
              {format(parseISO(entry.date), 'EEE d MMMM yyyy')}
            </span>
            {entry.time_of_day && (
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">
                {entry.time_of_day}
              </span>
            )}
            {entry.hours != null && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                {entry.hours}h
              </div>
            )}
          </div>
          {address && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <p className="text-sm text-slate-500">{address}</p>
            </div>
          )}
          {entry.office_surveyor && (
            <p className="text-xs text-slate-400">Office: {entry.office_surveyor.full_name}</p>
          )}
        </div>
      </div>

      {/* Hub tiles */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Actions</p>
        <div className="space-y-3">

          {/* Safety / JSA */}
          <HubTile
            href={`/field/${entryId}/safety`}
            icon={<ShieldCheck className="h-6 w-6" />}
            iconBg="bg-red-50 text-red-600"
            title="Risk Assessment"
            subtitle="Complete pre-start safety form"
            status={jsa ? 'done' : 'required'}
            statusLabel={jsa ? `Completed · ${format(parseISO(jsa.submitted_at), 'd MMM h:mm a')}` : 'Required before starting'}
          />

          {/* Job Brief */}
          <HubTile
            href={`/field/${entryId}/brief`}
            icon={<BookOpen className="h-6 w-6" />}
            iconBg="bg-purple-50 text-purple-600"
            title="Job Brief & Checklists"
            subtitle="Instructions and equipment checklist"
            status={brief ? 'available' : 'none'}
            statusLabel={brief ? 'Brief available' : 'No brief provided'}
          />

          {/* Site Photos */}
          <HubTile
            href={`/field/${entryId}/photos`}
            icon={<Camera className="h-6 w-6" />}
            iconBg="bg-emerald-50 text-emerald-600"
            title="Site Photos"
            subtitle="Capture and upload site images"
            status={(photoCount ?? 0) > 0 ? 'done' : 'pending'}
            statusLabel={(photoCount ?? 0) > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'} uploaded` : 'No photos yet'}
          />

          {/* Fieldbook Notes */}
          <HubTile
            href={`/field/${entryId}/notes`}
            icon={<FileText className="h-6 w-6" />}
            iconBg="bg-amber-50 text-amber-600"
            title="Fieldbook Notes"
            subtitle="Photograph your fieldbook pages"
            status={(notesCount ?? 0) > 0 ? 'done' : 'pending'}
            statusLabel={(notesCount ?? 0) > 0 ? `${notesCount} page${notesCount === 1 ? '' : 's'} uploaded` : 'No pages uploaded'}
          />

          {/* Time Log */}
          <HubTile
            href={`/field/${entryId}/time`}
            icon={<Timer className="h-6 w-6" />}
            iconBg="bg-blue-50 text-blue-600"
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
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">PM Notes</p>
            <p className="text-sm text-amber-800 whitespace-pre-wrap">{entry.notes}</p>
          </div>
        )}

        {/* Submit button */}
        <div className="mt-6 pb-8">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">End of Day</p>
          <SubmitJobButton
            entryId={entryId}
            projectId={entry.project_id}
            taskId={entry.task_id ?? null}
            taskTitle={task?.title ?? null}
            staffId={staffProfile.id}
            staffRole={(staffProfile as any).role ?? ''}
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
  title,
  subtitle,
  status,
  statusLabel,
  overtime,
}: {
  href: string
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  status: 'done' | 'required' | 'pending' | 'available' | 'none'
  statusLabel: string
  overtime?: boolean
}) {
  const statusIcon =
    status === 'done'     ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
    status === 'required' ? <AlertCircle  className="h-4 w-4 text-red-500"   /> :
                            <Circle       className="h-4 w-4 text-slate-300"  />

  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.99]"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 text-sm">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {statusIcon}
          <span className={`text-xs ${
            overtime ? 'text-orange-600 font-medium' :
            status === 'done' ? 'text-green-600' :
            status === 'required' ? 'text-red-500 font-medium' :
            'text-slate-400'
          }`}>
            {statusLabel}
          </span>
        </div>
      </div>
      <ChevronLeft className="h-4 w-4 text-slate-300 rotate-180 shrink-0" />
    </Link>
  )
}
