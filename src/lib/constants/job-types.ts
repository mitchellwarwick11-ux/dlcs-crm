export const JOB_TYPES = {
  survey: 'Survey',
  sewer_water: 'Sewer & Water',
  internal: 'Internal',
} as const

export type JobType = keyof typeof JOB_TYPES

export const JOB_TYPE_OPTIONS = Object.entries(JOB_TYPES).map(([value, label]) => ({
  value,
  label,
}))
