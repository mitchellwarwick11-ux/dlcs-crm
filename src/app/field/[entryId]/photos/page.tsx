import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, Camera } from 'lucide-react'
import { PhotoUpload } from '@/components/field/photo-upload'

export default async function PhotosPage({
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

  const { data: existingPhotos } = await db
    .from('field_photos')
    .select('id, storage_path, caption, original_size_bytes, compressed_size_bytes, uploaded_at')
    .eq('entry_id', entryId)
    .eq('type', 'site_photo')
    .order('uploaded_at', { ascending: true })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const jobLabel    = entry.projects?.job_number ?? entryId.slice(0, 8)

  return (
    <div className="flex flex-col flex-1 bg-[#E8E5DC]">
      {/* Header â€” charcoal */}
      <div className="bg-[#1A1A1E] px-4 pt-safe-top">
        <div className="flex items-center gap-2 py-3">
          <Link
            href={`/field/${entryId}`}
            className="p-1.5 -ml-1.5 rounded-lg text-[#BDBDC0] hover:bg-[#45454B] transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#F39200] font-bold tracking-[0.18em]">{jobLabel}</p>
            <h1 className="text-base font-bold text-white">Site Photos</h1>
          </div>
          {(existingPhotos?.length ?? 0) > 0 && (
            <span className="text-xs bg-[#45454B] text-[#F39200] font-bold px-2.5 py-1 rounded-full">
              {existingPhotos!.length}
            </span>
          )}
        </div>
      </div>

      <PhotoUpload
        entryId={entryId}
        projectId={entry.project_id}
        staffId={staffProfile.id}
        type="site_photo"
        existingPhotos={existingPhotos ?? []}
        supabaseUrl={supabaseUrl}
      />
    </div>
  )
}
