#!/usr/bin/env node
/**
 * Wipes WFM-imported rows from the live app tables.
 *
 * Only deletes rows where wfm_legacy_id IS NOT NULL, so
 * manually-entered data in the app is untouched.
 *
 * Order matters: child rows first (FK constraints).
 *
 * Usage:
 *   node scripts/wfm/99-reset.js              # asks for confirmation
 *   node scripts/wfm/99-reset.js --yes        # skip confirmation
 *   node scripts/wfm/99-reset.js --include-staging   # also truncate wfm_*_raw
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

const skipConfirm = process.argv.includes('--yes');
const includeStaging = process.argv.includes('--include-staging');

function ask(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (ans) => { rl.close(); res(ans); });
  });
}

async function deleteWfm(table) {
  // First count what would be deleted
  const { count: c1 } = await sb.from(table).select('*', { count: 'exact', head: true })
    .not('wfm_legacy_id', 'is', null);
  if (!c1) {
    console.log(`  ${table.padEnd(25)} 0`);
    return 0;
  }
  const { error } = await sb.from(table).delete().not('wfm_legacy_id', 'is', null);
  if (error) throw new Error(`delete ${table}: ${error.message}`);
  console.log(`  ${table.padEnd(25)} ${c1}`);
  return c1;
}

async function truncateStaging(table) {
  const { count: c1 } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (!c1) {
    console.log(`  ${table.padEnd(25)} 0`);
    return 0;
  }
  const { error } = await sb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(`truncate ${table}: ${error.message}`);
  console.log(`  ${table.padEnd(25)} ${c1}`);
  return c1;
}

async function main() {
  console.log(`▶ WFM reset   env=${envName}   target=${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log('');
  console.log('This will DELETE all rows where wfm_legacy_id IS NOT NULL from:');
  console.log('  time_entries, invoice_items, invoices, projects, client_contacts, clients');
  if (includeStaging) {
    console.log('AND truncate the wfm_*_raw staging tables.');
  }
  console.log('');
  console.log('Manually-entered data (with NULL wfm_legacy_id) will NOT be touched.');
  console.log('');

  if (!skipConfirm) {
    const ans = await ask('Type "yes" to proceed: ');
    if (ans.trim().toLowerCase() !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  console.log('\nDeleting...');
  // Order: children → parents
  await deleteWfm('time_entries');
  await deleteWfm('invoice_items');
  await deleteWfm('invoices');
  await deleteWfm('projects');
  await deleteWfm('client_contacts');
  await deleteWfm('clients');

  if (includeStaging) {
    console.log('\nTruncating staging...');
    await truncateStaging('wfm_invoiced_time_raw');
    await truncateStaging('wfm_invoices_raw');
    await truncateStaging('wfm_time_raw');
    await truncateStaging('wfm_jobs_raw');
    await truncateStaging('wfm_clients_raw');
  }

  console.log('\n✓ reset complete');
}

main().catch((err) => { console.error(err); process.exit(1); });
