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
