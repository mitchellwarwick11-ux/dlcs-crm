import { NextResponse } from 'next/server'

const PLACE_DETAILS    = 'https://places.googleapis.com/v1/places'
const NSW_PARISH_LAYER = 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Administrative_Boundaries_Theme/FeatureServer/5/query'
const NSW_LGA_LAYER    = 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Administrative_Boundaries_Theme/FeatureServer/8/query'

interface ResolvedAddress {
  streetAddress: string
  streetNumber:  string | null
  roadName:      string | null
  suburb:        string
  postcode:      string | null
  state:         string | null
  council:       string | null
  lga:           string | null
  parish:        string | null
  county:        string | null
  lat:           number | null
  lng:           number | null
}

function extractComponent(components: any[], type: string): string | null {
  const c = components?.find((c: any) => c.types?.includes(type))
  return c?.longText ?? c?.shortText ?? null
}

function toTitleCase(s: string | null | undefined): string | null {
  if (!s) return null
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function splitRoute(route: string): string {
  const parts = route.trim().split(/\s+/)
  if (parts.length < 2) return route.toUpperCase()
  parts.pop() // drop "Road" / "Street" etc
  return parts.join(' ').toUpperCase()
}

async function fetchPlaceDetails(placeId: string, sessionToken: string | undefined, apiKey: string, signal: AbortSignal) {
  const url = `${PLACE_DETAILS}/${encodeURIComponent(placeId)}${sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : ''}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'addressComponents,location,formattedAddress',
    },
    signal,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Place Details ${res.status}: ${text}`)
  }
  return res.json()
}

async function nswAdminQuery(layerUrl: string, outFields: string, lat: number, lng: number, signal: AbortSignal): Promise<Record<string, any> | null> {
  const url = new URL(layerUrl)
  url.searchParams.set('geometry', JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }))
  url.searchParams.set('geometryType', 'esriGeometryPoint')
  url.searchParams.set('inSR', '4326')
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  url.searchParams.set('outFields', outFields)
  url.searchParams.set('returnGeometry', 'false')
  url.searchParams.set('f', 'json')

  const timeoutCtrl = new AbortController()
  const timeoutId = setTimeout(() => timeoutCtrl.abort(), 5000)
  signal.addEventListener('abort', () => timeoutCtrl.abort())
  try {
    const res = await fetch(url.toString(), { signal: timeoutCtrl.signal, cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data.features?.[0]?.attributes ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
  }

  const { placeId, sessionToken } = await request.json() as { placeId?: string; sessionToken?: string }
  if (!placeId) {
    return NextResponse.json({ error: 'placeId is required' }, { status: 400 })
  }

  try {
    const details = await fetchPlaceDetails(placeId, sessionToken, apiKey, request.signal)
    const components = details.addressComponents ?? []

    const streetNumber = extractComponent(components, 'street_number')
    const route        = extractComponent(components, 'route')
    const suburb       = extractComponent(components, 'locality') ?? extractComponent(components, 'sublocality') ?? ''
    const postcode     = extractComponent(components, 'postal_code')
    const state        = extractComponent(components, 'administrative_area_level_1')
    const googleCouncil = extractComponent(components, 'administrative_area_level_2')

    const streetAddress = [streetNumber, route].filter(Boolean).join(' ')
    const roadName = route ? splitRoute(route) : null
    const lat = details.location?.latitude  ?? null
    const lng = details.location?.longitude ?? null

    let lga: string | null = null
    let parish: string | null = null
    let county: string | null = null

    if (state === 'New South Wales' && lat !== null && lng !== null) {
      const [parishAttrs, lgaAttrs] = await Promise.all([
        nswAdminQuery(NSW_PARISH_LAYER, 'parishname,countyname', lat, lng, request.signal),
        nswAdminQuery(NSW_LGA_LAYER,    'lganame',               lat, lng, request.signal),
      ])
      if (parishAttrs) {
        parish = toTitleCase(parishAttrs.parishname)
        county = toTitleCase(parishAttrs.countyname)
      }
      if (lgaAttrs) lga = toTitleCase(lgaAttrs.lganame)
    }

    const resolved: ResolvedAddress = {
      streetAddress,
      streetNumber,
      roadName,
      suburb,
      postcode,
      state,
      council: lga ?? googleCouncil,
      lga:     lga ?? googleCouncil,
      parish,
      county,
      lat,
      lng,
    }

    return NextResponse.json(resolved)
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return new NextResponse(null, { status: 499 })
    }
    return NextResponse.json({ error: err?.message ?? 'Resolve failed' }, { status: 502 })
  }
}
