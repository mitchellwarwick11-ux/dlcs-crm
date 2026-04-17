import { NextResponse } from 'next/server'

// Run at the edge — Vercel will execute this at the node closest to the user
// (Sydney for AU users), which is also close to NSW Spatial Services.
// Without this, the function runs in Washington DC, adding ~400ms round trip.
export const runtime = 'edge'

const BASE =
  'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Geocoded_Addressing_Theme/FeatureServer/3/query'

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function sql(s: string): string {
  return s.replace(/'/g, "''")  // escape single quotes
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 3) return NextResponse.json([])

  // Split input into optional house number + street name
  // e.g. "5 Smith"   → housenumber='5'   AND roadname LIKE 'SMITH%'
  // e.g. "123 High"  → housenumber='123' AND roadname LIKE 'HIGH%'
  // e.g. "Smith"     →                       roadname LIKE 'SMITH%'
  const numMatch = q.match(/^(\d+)\s+(\S+)/)
  const streetOnly = q.match(/^[A-Za-z]/)

  let where: string
  if (numMatch) {
    // Has a leading house number — use both fields for a tight, fast query
    const num    = sql(numMatch[1])
    const street = sql(numMatch[2])
    where = `housenumber = '${num}' AND UPPER(roadname) LIKE UPPER('${street}%')`
  } else if (streetOnly) {
    // Street name only — use the first word against roadname (indexed)
    const firstWord = sql(q.split(' ')[0])
    where = `UPPER(roadname) LIKE UPPER('${firstWord}%')`
  } else {
    // Fallback: starts-with on full address (slower but handles unusual input)
    where = `UPPER(address) LIKE UPPER('${sql(q)}%')`
  }

  const url = new URL(BASE)
  url.searchParams.set('where',            where)
  url.searchParams.set('outFields',        'housenumber,roadname,roadtype,suburbname,postcode,propid')
  url.searchParams.set('resultRecordCount','8')
  url.searchParams.set('returnGeometry',   'false')
  url.searchParams.set('f',               'json')

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86400 } })
    if (!res.ok) return NextResponse.json([])

    const data = await res.json()
    if (!data.features?.length) return NextResponse.json([])

    const suggestions = data.features
      .map((f: any) => {
        const a           = f.attributes
        const houseNum    = String(a.housenumber ?? '').trim()
        const roadName    = toTitleCase(a.roadname  ?? '')
        const roadType    = toTitleCase(a.roadtype  ?? '')
        const road        = [roadName, roadType].filter(Boolean).join(' ')
        const streetAddress = [houseNum, road].filter(Boolean).join(' ')
        const suburb      = toTitleCase(a.suburbname ?? '')
        const postcode    = a.postcode ? String(a.postcode) : ''

        return {
          label: [streetAddress, suburb, 'NSW', postcode].filter(Boolean).join(', '),
          streetAddress,
          suburb,
          state: 'NSW',
          postcode,
          propid: a.propid ?? null,
        }
      })
      .filter((s: any) => s.streetAddress.length > 0)

    // Deduplicate by streetAddress + suburb (keep the first occurrence's propid)
    const seen   = new Set<string>()
    const unique = suggestions.filter((s: any) => {
      const key = `${s.streetAddress}|${s.suburb}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json(unique.slice(0, 6))
  } catch {
    return NextResponse.json([])
  }
}
