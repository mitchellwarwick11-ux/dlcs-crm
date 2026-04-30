/**
 * Resolves the hourly rate for a staff member on a specific project.
 *
 * Pass `actingRole` to bill the entry under a role different to the staff member's
 * default (e.g. a Registered Surveyor working as a Field Assistant for the day).
 *
 * Resolution order, given the resolved role (acting role if provided, else staff default):
 *   1. project_role_rates for that role
 *   2. global role_rates for that role (if globalRoleRates passed)
 *   3. Staff member's default hourly rate
 *   4. 0
 */
export function resolveRate(
  staffId: string,
  staff: Array<{ id: string; role?: string | null; default_hourly_rate: number }>,
  projectRoleRates: Array<{ role_key: string; hourly_rate: number }>,
  actingRole?: string | null,
  globalRoleRates?: Array<{ role_key: string; hourly_rate: number }>
): number {
  const member = staff.find(s => s.id === staffId)
  if (!member) return 0
  const role = actingRole ?? member.role ?? null
  if (role) {
    const projectOverride = projectRoleRates.find(r => r.role_key === role)
    if (projectOverride) return Number(projectOverride.hourly_rate)
    if (globalRoleRates) {
      const global = globalRoleRates.find(r => r.role_key === role)
      if (global) return Number(global.hourly_rate)
    }
  }
  return Number(member.default_hourly_rate) || 0
}
