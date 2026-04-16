export const VIEW_AS_COOKIE = 'view_as_staff_id'

export type AccessLevel = 'staff' | 'project_manager' | 'admin'

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  staff: 'Staff',
  project_manager: 'Project Manager',
  admin: 'Admin',
}

// Nav hrefs visible per access level
export const ROLE_NAV: Record<AccessLevel, string[]> = {
  staff:           ['/my-work', '/projects', '/fieldwork', '/timesheets', '/field'],
  project_manager: ['/my-work', '/projects', '/quotes', '/clients', '/fieldwork', '/timesheets', '/field'],
  admin:           ['/my-work', '/projects', '/quotes', '/clients', '/staff', '/fieldwork', '/timesheets', '/reports', '/settings', '/field'],
}
