import { NextResponse } from 'next/server'

const BASE = 'https://portal.spatial.nsw.gov.au/server/rest/services'

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lot = searchParams.get('lot')?.trim()
  const plan = searchParams.get('plan')?.trim()

  if (!lot || !plan) {
    return NextResponse.json({ error: 'lot and plan are required' }, { status: 400 })
  }

  // Normalise plan label: accept "123456", "DP123456", "dp 123456", "DP 123456"
  const planLabel = plan.toUpperCase().replace(/\s+/g, '')
  const normalisedPlan = planLabel.startsWith('DP') ? planLabel : `DP${planLabel}`

  // Step 1: Get propid from PropertyLot layer
  const step1Url = new URL(`${BASE}/NSW_Property_Address_History/FeatureServer/4/query`)
  step1Url.searchParams.set('where', `lotnumber='${lot}' AND planlabel='${normalisedPlan}'`)
  step1Url.searchParams.set('outFields', 'lotnumber,sectionnumber,planlabel,plannumber,cadid,propid,enddate')
  step1Url.searchParams.set('returnGeometry', 'false')
  step1Url.searchParams.set('f', 'json')

  let step1Data: any
  try {
    const res = await fetch(step1Url.toString(), { next: { revalidate: 0 } })
    step1Data = await res.json()
  } catch {
    return NextResponse.json({ error: 'Failed to reach NSW Spatial Services. Please try again.' }, { status: 502 })
  }

  if (!step1Data.features?.length) {
    return NextResponse.json({ error: `No property found for Lot ${lot} ${normalisedPlan}` }, { status: 404 })
  }

  // Pick the most current record (highest enddate, with a valid cadid)
  const current = step1Data.features
    .map((f: any) => f.attributes)
    .filter((a: any) => a.cadid !== null)
    .sort((a: any, b: any) => b.enddate - a.enddate)[0]

  if (!current) {
    return NextResponse.json({ error: `No current record found for Lot ${lot} ${normalisedPlan}` }, { status: 404 })
  }

  const { propid } = current

  // Step 2: Get address from AddressString layer
  const step2Url = new URL(`${BASE}/NSW_Geocoded_Addressing_Theme/FeatureServer/3/query`)
  step2Url.searchParams.set('where', `propid=${propid}`)
  step2Url.searchParams.set('outFields', 'address,housenumber,roadname,roadtype,suburbname,postcode,council')
  step2Url.searchParams.set('returnGeometry', 'false')
  step2Url.searchParams.set('f', 'json')

  let step2Data: any
  try {
    const res = await fetch(step2Url.toString(), { next: { revalidate: 0 } })
    step2Data = await res.json()
  } catch {
    return NextResponse.json({ error: 'Failed to fetch address details. Please try again.' }, { status: 502 })
  }

  const addr = step2Data.features?.[0]?.attributes ?? null

  if (!addr) {
    // Lot/DP was found but has no address (e.g. vacant land with no street number)
    return NextResponse.json({
      lot: current.lotnumber,
      planLabel: current.planlabel,
      suburb: null,
      postcode: null,
      streetAddress: null,
      council: null,
      message: 'Property found but no street address is recorded (may be vacant land).',
    })
  }

  // Build a clean street address from components (without suburb, since suburb goes in its own field)
  const streetParts = [addr.housenumber, toTitleCase(addr.roadname), toTitleCase(addr.roadtype)].filter(Boolean)
  const streetAddress = streetParts.join(' ') || null

  return NextResponse.json({
    lot: current.lotnumber,
    planLabel: current.planlabel,
    streetAddress,
    suburb: addr.suburbname ? toTitleCase(addr.suburbname) : null,
    postcode: addr.postcode ? String(addr.postcode) : null,
    council: addr.council ? toTitleCase(addr.council) : null,
  })
}
