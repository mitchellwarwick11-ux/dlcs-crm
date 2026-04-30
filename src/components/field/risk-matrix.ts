// Shared risk matrix definitions used by the field-app picker and the PDF.
// Consequence index 1-4: 1=Minor … 4=Extreme
// Probability index 1-4: 1=Almost Certain … 4=Very Unlikely
// (matches the order shown in the DLCS Risk Assessment matrix.)

export type ConsequenceLevel = 1 | 2 | 3 | 4
export type ProbabilityLevel = 1 | 2 | 3 | 4

export type RiskBucket = '1/H' | '2/M' | '3/L' | '3/M'

export interface RiskRating {
  c: ConsequenceLevel
  p: ProbabilityLevel
}

export const CONSEQUENCE_LABELS: Record<ConsequenceLevel, { short: string; full: string; sub: string }> = {
  1: { short: 'Minor',    full: 'Minor',    sub: 'First Aid needed' },
  2: { short: 'Moderate', full: 'Moderate', sub: 'Medical attention and days off work' },
  3: { short: 'Major',    full: 'Major',    sub: 'Long term illness or serious injury' },
  4: { short: 'Extreme',  full: 'Extreme',  sub: 'Kill or cause permanent disability or ill health' },
}

export const PROBABILITY_LABELS: Record<ProbabilityLevel, { short: string; full: string; sub: string }> = {
  1: { short: 'AC', full: 'Almost Certain', sub: 'Could happen any time.' },
  2: { short: 'L',  full: 'Likely',         sub: 'Could happen sometimes.' },
  3: { short: 'U',  full: 'Unlikely',       sub: 'Could happen but rare.' },
  4: { short: 'VU', full: 'Very Unlikely',  sub: 'Could happen, but probably never will.' },
}

// Indexed [p-1][c-1].
const MATRIX: ReadonlyArray<ReadonlyArray<RiskBucket>> = [
  ['2/M', '1/H', '1/H', '1/H'], // p=1 Almost Certain
  ['2/M', '2/M', '1/H', '1/H'], // p=2 Likely
  ['3/L', '2/M', '2/M', '1/H'], // p=3 Unlikely
  ['3/L', '3/L', '2/M', '3/M'], // p=4 Very Unlikely
]

export function rateRisk(c: ConsequenceLevel, p: ProbabilityLevel): RiskBucket {
  return MATRIX[p - 1][c - 1]
}

export const BUCKET_COLORS: Record<RiskBucket, { bg: string; fg: string; border: string }> = {
  '1/H': { bg: '#E03B3B', fg: '#FFFFFF', border: '#B82E2E' }, // red
  '2/M': { bg: '#F2C341', fg: '#1F1F22', border: '#C99E2C' }, // amber-yellow
  '3/L': { bg: '#82C97A', fg: '#1F1F22', border: '#5FA85A' }, // green
  '3/M': { bg: '#F4A14C', fg: '#1F1F22', border: '#D17F2D' }, // orange
}

export function isValidRating(r: unknown): r is RiskRating {
  if (!r || typeof r !== 'object') return false
  const { c, p } = r as { c?: unknown; p?: unknown }
  return (
    (c === 1 || c === 2 || c === 3 || c === 4) &&
    (p === 1 || p === 2 || p === 3 || p === 4)
  )
}
