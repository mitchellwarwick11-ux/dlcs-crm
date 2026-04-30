import { NextResponse } from 'next/server'

// Google Places Autocomplete (New API v1)
// Docs: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete

const ENDPOINT = 'https://places.googleapis.com/v1/places:autocomplete'

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Places API key not configured', suggestions: [] }, { status: 500 })
  }

  const { input, sessionToken } = await request.json() as { input?: string; sessionToken?: string }

  if (!input || input.trim().length < 3) {
    return NextResponse.json({ suggestions: [] })
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input: input.trim(),
        sessionToken,
        includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
        includedRegionCodes: ['au'],
        languageCode: 'en-AU',
      }),
      signal: request.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Google API ${res.status}: ${text}`, suggestions: [] }, { status: 502 })
    }

    const data = await res.json()

    const suggestions = (data.suggestions ?? [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean)
      .map((p: any) => ({
        placeId:        p.placeId,
        label:          p.text?.text ?? '',
        mainText:       p.structuredFormat?.mainText?.text ?? '',
        secondaryText:  p.structuredFormat?.secondaryText?.text ?? '',
      }))

    return NextResponse.json({ suggestions })
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return new NextResponse(null, { status: 499 })
    }
    return NextResponse.json({ error: 'Address lookup failed', suggestions: [] }, { status: 502 })
  }
}
