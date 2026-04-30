// All field/office date math runs in Brisbane time. Vercel servers are UTC,
// so `new Date()` on the server can give yesterday's calendar date in the
// early morning AEST — anchor on Australia/Brisbane explicitly.

export const COMPANY_TZ = 'Australia/Brisbane'

type DateParts = {
  year: number
  month: number  // 1-12
  day: number
  hour: number   // 0-23
  minute: number
}

function partsInTz(d: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return {
    year:   get('year'),
    month:  get('month'),
    day:    get('day'),
    hour:   get('hour') % 24,  // some engines return 24 at midnight
    minute: get('minute'),
  }
}

/**
 * The current calendar date in Brisbane, as a Date set to local midnight on
 * the runtime. Use this everywhere `new Date()` would otherwise be used for
 * "today" calculations so server (UTC) and client agree.
 */
export function nowInCompanyTz(d: Date = new Date()) {
  const p = partsInTz(d, COMPANY_TZ)
  return {
    parts: p,
    /** YYYY-MM-DD string for today in Brisbane */
    isoDate: `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`,
    /** Local-runtime Date at midnight on Brisbane's calendar date — safe to pass to date-fns format() */
    midnightDate: new Date(p.year, p.month - 1, p.day),
  }
}

/** Add N days to a Brisbane-anchored midnight date and return YYYY-MM-DD */
export function addDaysIso(midnight: Date, days: number) {
  const d = new Date(midnight)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
