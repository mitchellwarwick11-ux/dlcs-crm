/**
 * Resolves the hourly rate for a staff member on a specific project.
 * Resolution order: job-specific rate override → staff default rate → 0
 *
 * Pass pre-fetched staff and projectRates arrays to avoid repeated DB calls.
 */
export function resolveRate(
  staffId: string,
  staff: Array<{ id: string; default_hourly_rate: number }>,
  projectRates: Array<{ staff_id: string; hourly_rate: number }>
): number {
  const override = projectRates.find(r => r.staff_id === staffId)
  if (override) return override.hourly_rate
  const member = staff.find(s => s.id === staffId)
  return member?.default_hourly_rate ?? 0
}
