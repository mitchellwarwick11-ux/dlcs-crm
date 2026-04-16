import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, FileText } from 'lucide-react'
import { PhotoUpload } from '@/components/field/photo-upload'

export default async function FieldNotesPage({
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
    .select('id, full_name')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()

  if (!staffProfile) redirect('/field')

  const { data: entry } = await db
    .from('field_schedule_entries')
    .select('id, date, project_id, projects ( job_number )')
    .eq('id', entryId)
    .maybeSingle()

  if (!entry) notFound()

  const { data: existingNotes } = await db
    .from('field_photos')
    .select('id, storage_path, caption, original_size_bytes, compressed_size_bytes, uploaded_at')
    .eq('entry_id', entryId)
    .eq('type', 'fieldbook_note')
    .order('uploaded_at', { ascending: true })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const jobLabel    = entry.projects?.job_number ?? entryId.slice(0, 8)

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-safe-top">
        <div className="flex items-center gap-2 py-3">
          <Link
            href={`/field/${entryId}`}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <FileText className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs text-slate-500 font-medium">{jobLabel}</p>
              <h1 className="text-base font-bold text-slate-900">Fieldbook Notes</h1>
            </div>
          </div>
          {(existingNotes?.length ?? 0) > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-1 rounded-full">
              {existingNotes!.length} page{existingNotes!.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <p className="text-sm text-slate-500">
          Photograph each page of your fieldbook clearly. Use good lighting and hold the camera directly above the page.
          Photos are compressed to ~20% of original size.
        </p>
      </div>

      <PhotoUpload
        entryId={entryId}
        projectId={entry.project_id}
        staffId={staffProfile.id}
        type="fieldbook_note"
        existingPhotos={existingNotes ?? []}
        supabaseUrl={supabaseUrl}
      />
    </div>
  )
}
