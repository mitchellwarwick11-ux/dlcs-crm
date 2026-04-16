'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage, formatBytes } from '@/lib/image-compress'
import { Camera, Upload, X, Loader2, CheckCircle2, AlertTriangle, Trash2, ImageIcon } from 'lucide-react'

interface ExistingPhoto {
  id: string
  storage_path: string
  caption: string | null
  original_size_bytes: number | null
  compressed_size_bytes: number | null
  uploaded_at: string
}

interface Props {
  entryId:       string
  projectId:     string
  staffId:       string
  type:          'site_photo' | 'fieldbook_note'
  existingPhotos: ExistingPhoto[]
  supabaseUrl:   string
}

interface PendingFile {
  id:          string
  original:    File
  compressed:  Blob | null
  preview:     string
  caption:     string
  compressing: boolean
  originalSize:    number
  compressedSize:  number | null
}

export function PhotoUpload({ entryId, projectId, staffId, type, existingPhotos, supabaseUrl }: Props) {
  const router    = useRouter()
  const inputRef  = useRef<HTMLInputElement>(null)

  const [pending,   setPending]   = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)

  const isDocument = type === 'fieldbook_note'

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)

    const newItems: PendingFile[] = Array.from(files).map(f => ({
      id:             Math.random().toString(36).slice(2),
      original:       f,
      compressed:     null,
      preview:        URL.createObjectURL(f),
      caption:        '',
      compressing:    true,
      originalSize:   f.size,
      compressedSize: null,
    }))

    setPending(prev => [...prev, ...newItems])

    // Compress each file
    for (const item of newItems) {
      try {
        const result = await compressImage(item.original, 2000, 0.55, isDocument)
        setPending(prev => prev.map(p =>
          p.id === item.id
            ? { ...p, compressed: result.blob, compressedSize: result.compressedBytes, compressing: false }
            : p
        ))
      } catch {
        setPending(prev => prev.map(p =>
          p.id === item.id ? { ...p, compressing: false } : p
        ))
      }
    }
  }

  function removePending(id: string) {
    setPending(prev => {
      const item = prev.find(p => p.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter(p => p.id !== id)
    })
  }

  function updateCaption(id: string, caption: string) {
    setPending(prev => prev.map(p => p.id === id ? { ...p, caption } : p))
  }

  async function uploadAll() {
    if (pending.length === 0) return
    const stillCompressing = pending.some(p => p.compressing)
    if (stillCompressing) { setError('Still compressing — please wait a moment.'); return }

    setUploading(true)
    setError(null)
    const db = createClient() as any

    for (const item of pending) {
      const blob     = item.compressed ?? item.original
      const ext      = isDocument ? 'jpg' : 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const path     = `${projectId}/${entryId}/${type}/${fileName}`

      const { error: storErr } = await (createClient() as any).storage
        .from('field-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false })

      if (storErr) {
        setError(`Upload failed for ${item.original.name}: ${storErr.message}`)
        setUploading(false)
        return
      }

      await db.from('field_photos').insert({
        entry_id:              entryId,
        project_id:            projectId,
        staff_id:              staffId,
        storage_path:          path,
        original_size_bytes:   item.originalSize,
        compressed_size_bytes: item.compressedSize ?? null,
        type,
        caption:               item.caption.trim() || null,
      })
    }

    // Clean up previews
    pending.forEach(p => URL.revokeObjectURL(p.preview))
    setPending([])
    router.refresh()
    setUploading(false)
  }

  async function deletePhoto(photo: ExistingPhoto) {
    if (!confirm(`Delete this ${isDocument ? 'page' : 'photo'}? This cannot be undone.`)) return
    setDeleting(photo.id)
    const db = createClient() as any

    await (createClient() as any).storage.from('field-photos').remove([photo.storage_path])
    await db.from('field_photos').delete().eq('id', photo.id)
    router.refresh()
    setDeleting(null)
  }

  function getSignedUrl(path: string) {
    return `${supabaseUrl}/storage/v1/object/sign/field-photos/${path}`
  }

  const typeLabel = isDocument ? 'fieldbook page' : 'photo'
  const typeLabelPlural = isDocument ? 'fieldbook pages' : 'photos'

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-5 space-y-5">

        {/* Upload zone */}
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-blue-300 rounded-xl p-6 text-center bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors active:scale-[0.98]"
        >
          {isDocument
            ? <ImageIcon className="h-10 w-10 text-blue-400 mx-auto mb-2" />
            : <Camera    className="h-10 w-10 text-blue-400 mx-auto mb-2" />
          }
          <p className="text-sm font-semibold text-blue-700">
            {isDocument ? 'Photograph fieldbook pages' : 'Take or choose photos'}
          </p>
          <p className="text-xs text-blue-500 mt-1">
            Photos are automatically compressed to ~20% of original size
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        {/* Pending files */}
        {pending.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Ready to upload ({pending.length})
            </p>
            <div className="space-y-3">
              {pending.map(item => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {/* Preview */}
                  <div className="relative h-32 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePending(item.id)}
                      className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {item.compressing && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Compressing…</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    {/* Size indicator */}
                    {!item.compressing && item.compressedSize && (
                      <p className="text-[10px] text-slate-400">
                        {formatBytes(item.originalSize)} → {formatBytes(item.compressedSize)}
                        {' '}({Math.round(item.compressedSize / item.originalSize * 100)}% of original)
                      </p>
                    )}

                    {/* Caption */}
                    <input
                      type="text"
                      value={item.caption}
                      onChange={e => updateCaption(item.id, e.target.value)}
                      placeholder={`Add a caption (optional)`}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 mt-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={uploadAll}
              disabled={uploading || pending.some(p => p.compressing)}
              className="mt-3 w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {uploading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                : <><Upload className="h-4 w-4" /> Upload {pending.length} {pending.length === 1 ? typeLabel : typeLabelPlural}</>
              }
            </button>
          </div>
        )}

        {/* Uploaded photos */}
        {existingPhotos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Uploaded ({existingPhotos.length})
            </p>
            <div className="grid grid-cols-2 gap-2">
              {existingPhotos.map(photo => (
                <div key={photo.id} className="relative bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${supabaseUrl}/storage/v1/object/authenticated/field-photos/${photo.storage_path}`}
                    alt={photo.caption ?? ''}
                    className="w-full aspect-[4/3] object-cover"
                    loading="lazy"
                  />
                  <div className="p-2">
                    {photo.caption && (
                      <p className="text-xs text-slate-600 mb-1 truncate">{photo.caption}</p>
                    )}
                    {photo.compressed_size_bytes && photo.original_size_bytes && (
                      <p className="text-[10px] text-slate-400">
                        {formatBytes(photo.compressed_size_bytes)}
                      </p>
                    )}
                    <button
                      onClick={() => deletePhoto(photo)}
                      disabled={deleting === photo.id}
                      className="mt-1 flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      {deleting === photo.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />
                      }
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {existingPhotos.length === 0 && pending.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-slate-400">
              No {typeLabelPlural} uploaded yet.
            </p>
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  )
}
