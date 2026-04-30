#!/usr/bin/env node
/**
 * Geocodes site_address on all projects missing site_lat/site_lng and writes
 * them back to the row. Uses Google Geocoding API.
 *
 * Required env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_PLACES_API_KEY   (Geocoding uses the same key)
 *
 * Usage:  node scripts/backfill-project-coords.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ── Load .env.local ─────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) return;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const srvKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!url || !srvKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
if (!apiKey) {
  console.error('Missing GOOGLE_PLACES_API_KEY in .env.local');
  process.exit(1);
}

const sb = createClient(url, srvKey, { auth: { persistSession: false } });

async function geocode(address) {
  // Uses Places API (New) Text Search — same API the address autocomplete
  // uses, so the existing GOOGLE_PLACES_API_KEY is already authorised.
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.location,places.formattedAddress',
    },
    body: JSON.stringify({
      textQuery: address,
      regionCode: 'AU',
      maxResultCount: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const place = data.places?.[0];
  if (!place?.location) return null;
  return { lat: place.location.latitude, lng: place.location.longitude };
}

async function main() {
  const { data: rows, error } = await sb
    .from('projects')
    .select('id, job_number, site_address, suburb, site_lat, site_lng')
    .is('site_lat', null)
    .not('site_address', 'is', null);

  if (error) {
    console.error('Failed to load projects:', error.message);
    process.exit(1);
  }

  console.log(`Found ${rows.length} projects to geocode.`);
  let ok = 0, fail = 0;

  for (const row of rows) {
    const full = [row.site_address, row.suburb, 'Australia'].filter(Boolean).join(', ');
    try {
      const coords = await geocode(full);
      if (!coords) {
        console.log(`  [MISS] ${row.job_number}  ${full}`);
        fail++;
      } else {
        await sb.from('projects').update({ site_lat: coords.lat, site_lng: coords.lng }).eq('id', row.id);
        console.log(`  [OK]   ${row.job_number}  ${full}  →  ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        ok++;
      }
    } catch (err) {
      console.log(`  [ERR]  ${row.job_number}  ${err.message}`);
      fail++;
    }
    // Stay under Google's 50 QPS quota with a relaxed pace
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nDone. Geocoded ${ok}, failed ${fail}.`);
}

main().catch(err => { console.error(err); process.exit(1); });
