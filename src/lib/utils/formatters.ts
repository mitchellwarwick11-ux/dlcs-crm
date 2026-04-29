import { format, parseISO } from 'date-fns'

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy')
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy h:mm a')
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`
}

export function calcGST(subtotal: number): number {
  return Math.round(subtotal * 0.1 * 100) / 100
}

export function calcTotal(subtotal: number): number {
  return Math.round((subtotal + calcGST(subtotal)) * 100) / 100
}

// Strip a leading job-number prefix from a project title, so titles like
// "21404 - Gillieston Heights" don't render as "21404 21404 - Gillieston Heights"
// when shown next to the job number column. Tolerates separators ("-", "–",
// "—", ":", "/") and surrounding whitespace.
export function stripJobNumberPrefix(title: string | null | undefined, jobNumber: string | null | undefined): string {
  if (!title) return ''
  if (!jobNumber) return title
  const escaped = jobNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re      = new RegExp(`^\\s*${escaped}\\s*[-–—:/]?\\s*`)
  return title.replace(re, '').trim()
}

// Format an Australian phone number as the user types.
// Mobile (04XX): "04## ### ###"
// Landline (02/03/07/08): "0# #### ####"
// Anything else: digits returned unspaced (up to 10).
export function formatAUPhone(input: string): string {
  const digits = (input ?? '').replace(/\D/g, '').slice(0, 10)
  if (!digits) return ''
  if (digits.startsWith('04')) {
    if (digits.length <= 4) return digits
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  if (/^0[2378]/.test(digits)) {
    if (digits.length <= 2) return digits
    if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`
  }
  return digits
}
