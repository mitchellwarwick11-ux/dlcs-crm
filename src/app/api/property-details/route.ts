import { NextResponse } from 'next/server'

export const runtime = 'edge'

const BASE = 'https://portal.spatial.nsw.gov.au/server/rest/services'

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// Try multiple potential cadastre endpoints for parish/county lookup.
// NSW Spatial Services moves layers around occasionally — this gives
// a small amount of resilience without re-implementing each layer's schema.
const CADASTRE_LOT_CANDIDATES: Array<{ url: string; parishField: string; countyField: string }> = [
  {
    url: `${BASE}/NSW_Cadastre/FeatureServer/9/query`,
    parishField: 'parishname',
    countyField: 'countyname',
  },
  {
    url: `${BASE}/NSW_Cadastre/MapServer/9/query`,
    parishField: 'parishname',
    countyField: 'countyname',
  },
]

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const propid = searchParams.get('propid')?.trim()

  if (!propid) {
    return NextResponse.json({ error: 'propid is required' }, { status: 400 })
  }

  // 1. Address string (suburb, council/LGA, postcode, full street address)
  const addrUrl = new URL(`${BASE}/NSW_Geocoded_Addressing_Theme/FeatureServer/3/query`)
  addrUrl.searchParams.set('where', `propid=${Number(propid)}`)
  addrUrl.searchParams.set('outFields', 'address,housenumber,roadname,roadtype,suburbname,postcode,council')
  addrUrl.searchParams.set('returnGeometry', 'false')
  addrUrl.searchParams.set('f', 'json')

  // 2. Property lot (lot/section/plan/cadid)
  const lotUrl = new URL(`${BASE}/NSW_Property_Address_History/FeatureServer/4/query`)
  lotUrl.searchParams.set('where', `propid=${Number(propid)}`)
  lotUrl.searchParams.set('outFields', 'lotnumber,sectionnumber,planlabel,plannumber,cadid,enddate')
  lotUrl.searchParams.set('returnGeometry', 'false')
  lotUrl.searchParams.set('f', 'json')

  const [addrData, lotData] = await Promise.all([
    fetchJson(addrUrl.toString()),
    fetchJson(lotUrl.toString()),
  ])

  const addr = addrData?.features?.[0]?.attributes ?? null

  // Pick most current lot record (highest enddate, with valid cadid)
  const lots: any[] = (lotData?.features ?? [])
    .map((f: any) => f.attributes)
    .filter((a: any) => a.cadid != null)
  const currentLot =
    lots.sort((a: any, b: any) => (b.enddate ?? 0) - (a.enddate ?? 0))[0] ?? null

  // 3. Cadastre for parish/county (best effort)
  let parish: string | null = null
  let county: string | null = null
  if (currentLot?.cadid) {
    for (const candidate of CADASTRE_LOT_CANDIDATES) {
      const cadUrl = new URL(candidate.url)
      cadUrl.searchParams.set('where', `cadid=${Number(currentLot.cadid)}`)
      cadUrl.searchParams.set(
        'outFields',
        `${candidate.parishField},${candidate.countyField}`,
      )
      cadUrl.searchParams.set('returnGeometry', 'false')
      cadUrl.searchParams.set('f', 'json')
      const cadData = await fetchJson(cadUrl.toString())
      const cadAttrs = cadData?.features?.[0]?.attributes
      if (cadAttrs) {
        parish = cadAttrs[candidate.parishField]
          ? toTitleCase(cadAttrs[candidate.parishField])
          : null
        county = cadAttrs[candidate.countyField]
          ? toTitleCase(cadAttrs[candidate.countyField])
          : null
        if (parish || county) break
      }
    }
  }

  // Build clean street address
  const streetParts = addr
    ? [
        addr.housenumber,
        addr.roadname ? toTitleCase(addr.roadname) : '',
        addr.roadtype ? toTitleCase(addr.roadtype) : '',
      ].filter(Boolean)
    : []
  const streetAddress = streetParts.join(' ') || null

  return NextResponse.json({
    streetAddress,
    suburb:    addr?.suburbname ? toTitleCase(addr.suburbname) : null,
    postcode:  addr?.postcode   ? String(addr.postcode)        : null,
    lot:       currentLot?.lotnumber     ?? null,
    section:   currentLot?.sectionnumber ?? null,
    planLabel: currentLot?.planlabel     ?? null,
    lga:       addr?.council     ? toTitleCase(addr.council)   : null,
    parish,
    county,
  })
}
