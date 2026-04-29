#!/usr/bin/env node
/**
 * One-off helper: creates Supabase auth users for current staff
 * so the transform can link time entries to real profiles instead
 * of the legacy-staff placeholder.
 *
 * The staff_profiles row is auto-created by the handle_new_user
 * trigger on the auth.users table.
 *
 * Idempotent: skips users that already exist.
 *
 * Usage:
 *   node scripts/wfm/create-staff-users.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

// Current DLCS staff (excl. Mitch Warwick — already created).
// Roles default to 'drafting' (the trigger default); update in app
// Settings → Staff after import if specific roles matter.
const STAFF = [
  { name: 'Alex Lascelles',      email: 'alex@delacs.com.au' },
  { name: 'Ben Stone',           email: 'ben@delacs.com.au' },
  { name: 'Dean Blakemore',      email: 'dean@delacs.com.au' },
  { name: 'Doug Loth',           email: 'doug@delacs.com.au' },
  { name: 'Justin Dunlop',       email: 'justin@delacs.com.au' },
  { name: 'Lachlan Manning',     email: 'lachlan@delacs.com.au' },
  { name: 'Liam Marshall',       email: 'liam@delacs.com.au' },
  { name: 'Nigel Delfs',         email: 'nigel@delacs.com.au' },
  { name: 'Phillip Marriott',    email: 'phil@delacs.com.au' },
  { name: 'Rob Tisdell',         email: 'rob@delacs.com.au' },
  { name: 'Stephen Felton',      email: 'stephen@delacs.com.au' },
  { name: 'Teina Harawira',      email: 'teina@delacs.com.au' },
  { name: 'Tim Rheinberger',     email: 'tim@delacs.com.au' },
  { name: 'Tom Braund',          email: 'tomb@delacs.com.au' },
  { name: 'Tom Campbell',        email: 'tom@delacs.com.au' },
];

async function main() {
  console.log(`▶ Creating staff auth users on ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);
  let created = 0, skipped = 0;
  for (const s of STAFF) {
    // Generate a random secure password they can reset later
    const password = crypto.randomBytes(24).toString('base64');
    const { data, error } = await sb.auth.admin.createUser({
      email: s.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: s.name },
    });
    if (error) {
      if (/already.*registered|email.*exists|duplicate/i.test(error.message)) {
        console.log(`  · ${s.name.padEnd(20)} ${s.email.padEnd(30)} skipped (exists)`);
        skipped++;
      } else {
        console.error(`  ✗ ${s.name}: ${error.message}`);
      }
      continue;
    }
    // Update full_name on staff_profiles (trigger sets it from email prefix by default)
    await sb.from('staff_profiles').update({ full_name: s.name }).eq('id', data.user.id);
    console.log(`  ✓ ${s.name.padEnd(20)} ${s.email.padEnd(30)} created`);
    created++;
  }
  console.log(`\n${created} created, ${skipped} skipped.`);
  console.log(`Staff can reset their password via the app's password reset flow when ready.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
