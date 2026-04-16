export interface QuoteTemplate {
  label: string
  scopeItems: string[]
  notes?: string[]
}

export const QUOTE_TEMPLATES: Record<string, QuoteTemplate> = {
  contour_detail: {
    label: 'Contour & Detail Survey',
    scopeItems: [
      'Site boundaries shown (dimensions and approximate positions).',
      'All levels and contours shown relative to AHD.',
      'Place benchmark on site.',
      'Location of any existing easements affecting the site.',
      'Location of all buildings on site including Building Finished Floor Levels (FFL).',
      'Location of existing fencing, retaining walls and steps.',
      'Location of trees on site — including canopy spreads, trunk diameters and heights.',
      'Roof heights of subject lot (ridge and gutters).',
      'Levels of neighbouring building roofs within close proximity of site boundary (where accessible).',
      'Neighbouring walls, window sill and head heights facing the subject site (where accessible).',
      'Neighbouring building frontages (within 40m where accessible).',
      'Spot levels across the site, along all boundaries and kerb and gutter.',
      'Location of visible above ground services including sewer manholes and sewer inspection pits, etc.',
      'Drainage pits and inverts (if accessible).',
      'DBYD overlay of existing services.',
    ],
  },
}

export const QUOTE_TEMPLATE_OPTIONS = Object.entries(QUOTE_TEMPLATES).map(([value, t]) => ({
  value,
  label: t.label,
}))
