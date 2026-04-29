#!/usr/bin/env node
/**
 * Helper: read all distinct staff names from staging, write them
 * to scripts/wfm/mappings/staff_name_to_email.csv with sensible
 * defaults. You can edit the file by hand afterward.
 *
 * Usage:
 *   node scripts/wfm/populate-staff-mapping.js
 */

const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
const { createClient } = require('@supabase/supabase-js');

const envName = process.env.WFM_ENV || 'staging';
const envFile = envName === 'production' ? '.env.local' : '.env.staging.local';
const envPath = path.join(__dirname, '..', '..', envFile);
fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m) return;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Current DLCS staff. Both "Name" and "Name (deleted)" variants
// are mapped to the same email — WFM keeps a "(deleted)" entry for
// people who left at some point but are now back, or were renamed.
const CURRENT_STAFF = {
  'Mitch Warwick':       'mitchell.warwick11@gmail.com',
  'Alex Lascelles':      'alex@delacs.com.au',
  'Ben Stone':           'ben@delacs.com.au',
  'Dean Blakemore':      'dean@delacs.com.au',
  'Doug Loth':           'doug@delacs.com.au',
  'Douglas Loth':        'doug@delacs.com.au',
  'Justin Dunlop':       'justin@delacs.com.au',
  'Lachlan Manning':     'lachlan@delacs.com.au',
  'Liam Marshall':       'liam@delacs.com.au',
  'Nigel Delfs':         'nigel@delacs.com.au',
  'Phillip Marriott':    'phil@delacs.com.au',
  'Rob Tisdell':         'rob@delacs.com.au',
  'Stephen Felton':      'stephen@delacs.com.au',
  'Teina Harawira':      'teina@delacs.com.au',
  'Tim Rheinberger':     'tim@delacs.com.au',
  'Tom Braund':          'tomb@delacs.com.au',
  'Tom Campbell':        'tom@delacs.com.au',
};
// Build KNOWN with both "Name" and "Name (deleted)" pointing to the same email.
const KNOWN = {};
for (const [n, e] of Object.entries(CURRENT_STAFF)) {
  KNOWN[n] = e;
  KNOWN[`${n} (deleted)`] = e;
}
const PLACEHOLDER = 'legacy-staff@dlcs.local';

async function fetchAllStaffNames(table, col) {
  const all = new Set();
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb.from(table).select(col).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      const v = r[col];
      if (v && String(v).trim()) all.add(String(v).trim());
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  const a = await fetchAllStaffNames('wfm_time_raw', 'staff_name');
  const b = await fetchAllStaffNames('wfm_invoiced_time_raw', 'staff_name');
  const all = [...new Set([...a, ...b])].sort();

  const rows = all.map((name) => ({
    wfm_staff_name: name,
    staff_email: KNOWN[name] || PLACEHOLDER,
  }));

  const out = stringify(rows, { header: true, columns: ['wfm_staff_name', 'staff_email'], quoted_string: true });
  const outPath = path.join(__dirname, 'mappings', 'staff_name_to_email.csv');
  fs.writeFileSync(outPath, out);

  const knownCount = rows.filter((r) => r.staff_email !== PLACEHOLDER).length;
  console.log(`Wrote ${rows.length} staff to ${outPath}`);
  console.log(`  ${knownCount} known mappings`);
  console.log(`  ${rows.length - knownCount} mapped to placeholder ${PLACEHOLDER}`);
  console.log(`\nEdit the CSV to add more known mappings (currentstaff@dlcs...) as needed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
