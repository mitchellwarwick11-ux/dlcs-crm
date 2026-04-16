'use client'

// Small circular avatar showing staff member's initials with
// a deterministic background color derived from their name.

const SIZE_CLASSES = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-7 w-7 text-xs',
  lg: 'h-9 w-9 text-sm',
} as const

type Size = keyof typeof SIZE_CLASSES

function getInitials(name: string): string {
  const cleaned = name.trim()
  if (!cleaned) return '?'
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function getAvatarColor(name: string): { bg: string; fg: string } {
  const hue = hashString(name) % 360
  return {
    bg: `hsl(${hue}, 55%, 45%)`,
    fg: '#fff',
  }
}

interface StaffAvatarProps {
  name: string | null | undefined
  size?: Size
  className?: string
  title?: string
}

export function StaffAvatar({ name, size = 'sm', className = '', title }: StaffAvatarProps) {
  const displayName = (name ?? '').trim()
  const initials = displayName ? getInitials(displayName) : '?'
  const color = displayName
    ? getAvatarColor(displayName)
    : { bg: 'hsl(220, 10%, 80%)', fg: '#64748b' }

  return (
    <span
      title={title ?? displayName ?? undefined}
      className={`inline-flex items-center justify-center rounded-full font-semibold select-none ring-2 ring-white ${SIZE_CLASSES[size]} ${className}`}
      style={{ backgroundColor: color.bg, color: color.fg }}
      aria-label={displayName || 'Unassigned'}
    >
      {initials}
    </span>
  )
}

interface StaffAvatarStackProps {
  names: string[]
  size?: Size
  limit?: number
  className?: string
}

export function StaffAvatarStack({ names, size = 'sm', limit = 3, className = '' }: StaffAvatarStackProps) {
  if (names.length === 0) {
    return <StaffAvatar name={null} size={size} className={className} title="Unassigned" />
  }
  const visible = names.slice(0, limit)
  const extra = names.length - visible.length
  return (
    <div className={`inline-flex items-center -space-x-2 ${className}`}>
      {visible.map((n, i) => (
        <StaffAvatar key={n + i} name={n} size={size} />
      ))}
      {extra > 0 && (
        <span
          className={`inline-flex items-center justify-center rounded-full font-semibold bg-slate-200 text-slate-700 ring-2 ring-white ${SIZE_CLASSES[size]}`}
          title={names.slice(limit).join(', ')}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
