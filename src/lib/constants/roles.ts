// Static fallback labels — the live source of truth is the role_rates table in the DB
export const USER_ROLES: Record<string, string> = {
  registered_surveyor:  'Registered Surveyor',
  field_surveyor:       'Field Surveyor',
  office_surveyor:      'Office Surveyor',
  sewer_water_designer: 'Sewer & Water Designer',
  drafting:             'Drafter',
  administration:       'Administration',
}

export type UserRole = keyof typeof USER_ROLES

export const USER_ROLE_OPTIONS = Object.entries(USER_ROLES).map(([value, label]) => ({
  value,
  label,
}))
