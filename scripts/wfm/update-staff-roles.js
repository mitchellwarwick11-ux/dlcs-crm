#!/usr/bin/env node
/**
 * One-off helper: set the `role` column on staff_profiles for
 * current DLCS staff. Run after create-staff-users.js.
 *
 * Usage:
 *   node scripts/wfm/update-staff-roles.js
 */

const fs = require('fs');
const path = require('path');
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

// email → role
const ROLES = {
  'mitchell.warwick11@gmail.com': 'registered_surveyor',
  'alex@delacs.com.au':           'registered_surveyor',
  'nigel@delacs.com.au':          'registered_surveyor',
  'phil@delacs.com.au':           'registered_surveyor',
  'tim@delacs.com.au':            'registered_surveyor',
  'tom@delacs.com.au':            'registered_surveyor',
  'ben@delacs.com.au':            'field_surveyor',
  'doug@delacs.com.au':           'field_surveyor',
  'rob@delacs.com.au':            'field_surveyor',
  'stephen@delacs.com.au':        'field_surveyor',
  'teina@delacs.com.au':          'field_surveyor',
  'tomb@delacs.com.au':           'field_surveyor',
  'dean@delacs.com.au':           'office_surveyor',
  'lachlan@delacs.com.au':        'office_surveyor',
  'liam@delacs.com.au':           'office_surveyor',
  'justin@delacs.com.au':         'drafting',
};

async function main() {
  console.log(`▶ Updating staff roles on ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);
  let updated = 0, missing = 0;
  for (const [email, role] of Object.entries(ROLES)) {
    const { data, error } = await sb.from('staff_profiles')
      .update({ role })
      .eq('email', email)
      .select('full_name, email, role');
    if (error) { console.error(`  ✗ ${email}: ${error.message}`); continue; }
    if (!data || data.length === 0) {
      console.log(`  · ${email.padEnd(35)} not found`);
      missing++;
    } else {
      console.log(`  ✓ ${data[0].full_name.padEnd(20)} ${email.padEnd(35)} → ${role}`);
      updated++;
    }
  }
  console.log(`\n${updated} updated, ${missing} missing.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
