import { NextResponse } from 'next/server'

const NSW_ADDRESS_LAYER  = 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Geocoded_Addressing_Theme/FeatureServer/3/query'
const NSW_PROPERTY_LAYER = 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Property_Address_History/FeatureServer/4/query'

async function nswQuery(url: URL, timeoutMs: number, signal: AbortSignal): Promise<any> {
  const timeoutCtrl = new AbortController()
  const timeoutId = setTimeout(() => timeoutCtrl.abort(), timeoutMs)
  signal.addEventListener('abort', () => timeoutCtrl.abort())
  try {
    const res = await fetch(url.toString(), {
      signal: timeoutCtrl.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; DLCS-CRM/1.0)' },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function POST(request: Request) {
  const { housenumber, roadname, suburb } = await request.json() as {
    housenumber?: string
    roadname?:    string
    suburb?:      string
  }

  if (!housenumber || !roadname || !suburb) {
    return NextResponse.json({ lot: null, section: null, plan: null })
  }

  const safe = (s: string) => s.replace(/'/g, "''").toUpperCase()

  // Step 1: address components → propid
  // NSW address layer has no text indexes — expect 5-15s for this query.
  const addrUrl = new URL(NSW_ADDRESS_LAYER)
  addrUrl.searchParams.set('where',
    `housenumber='${safe(housenumber)}' AND roadname='${safe(roadname)}' AND suburbname='${safe(suburb)}'`)
  addrUrl.searchParams.set('outFields', 'propid')
  addrUrl.searchParams.set('returnGeometry', 'false')
  addrUrl.searchParams.set('resultRecordCount', '1')
  addrUrl.searchParams.set('f', 'json')

  const addrData = await nswQuery(addrUrl, 20000, request.signal)
  const propid = addrData?.features?.[0]?.attributes?.propid
  if (!propid) {
    console.log(`[lot] no propid match for ${housenumber} ${roadname} ${suburb}`)
    return NextResponse.json({ lot: null, section: null, plan: null })
  }

  // Step 2: propid → lot/section/plan (pick most current record)
  const propUrl = new URL(NSW_PROPERTY_LAYER)
  propUrl.searchParams.set('where', `propid=${propid}`)
  propUrl.searchParams.set('outFields', 'lotnumber,sectionnumber,planlabel,cadid,enddate')
  propUrl.searchParams.set('returnGeometry', 'false')
  propUrl.searchParams.set('f', 'json')

  const propData = await nswQuery(propUrl, 6000, request.signal)
  const current = (propData?.features ?? [])
    .map((f: any) => f.attributes)
    .filter((a: any) => a.cadid !== null)
    .sort((a: any, b: any) => (b.enddate ?? 0) - (a.enddate ?? 0))[0]

  if (!current) {
    return NextResponse.json({ lot: null, section: null, plan: null, propid })
  }

  const result = {
    lot:     current.lotnumber     ? String(current.lotnumber)     : null,
    section: current.sectionnumber ? String(current.sectionnumber) : null,
    plan:    current.planlabel     ? String(current.planlabel)     : null,
    propid,
  }
  console.log(`[lot] propid=${propid} → ${JSON.stringify(result)}`)
  return NextResponse.json(result)
}
