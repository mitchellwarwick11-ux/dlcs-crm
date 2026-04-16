/**
 * Client-side image compression using Canvas API.
 * Targets ~20% of original file size by combining resolution reduction + JPEG encoding.
 */

export interface CompressResult {
  blob: Blob
  originalBytes: number
  compressedBytes: number
  compressionPct: number
}

/**
 * Compress an image File to approximately 20% of its original size.
 * @param file        Source image file
 * @param maxDimension Max width or height in pixels (default 2000)
 * @param quality     JPEG quality 0–1 (default 0.55 — combined with resize gives ~20%)
 * @param isDocument  Use higher quality for fieldbook notes with fine handwriting
 */
export async function compressImage(
  file: File,
  maxDimension = 2000,
  quality = 0.55,
  isDocument = false,
): Promise<CompressResult> {
  const resolvedQuality = isDocument ? 0.70 : quality

  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      // Calculate new dimensions keeping aspect ratio
      const { width, height } = img
      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const newW = Math.round(width  * scale)
      const newH = Math.round(height * scale)

      const canvas = document.createElement('canvas')
      canvas.width  = newW
      canvas.height = newH

      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas context unavailable')); return }

      // White background (avoids transparent → black in JPEG)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, newW, newH)
      ctx.drawImage(img, 0, 0, newW, newH)

      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('Compression failed')); return }
          resolve({
            blob,
            originalBytes:   file.size,
            compressedBytes: blob.size,
            compressionPct:  Math.round((blob.size / file.size) * 100),
          })
        },
        'image/jpeg',
        resolvedQuality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}

/** Format bytes as human-readable string (e.g. "2.3 MB") */
export function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
