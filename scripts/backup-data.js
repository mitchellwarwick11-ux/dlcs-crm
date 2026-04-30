#!/usr/bin/env node
/**
 * Dumps every relevant Supabase table to a timestamped JSON file in reference/.
 * Matches the structure of the UI backup (version 3), and is readable by
 * scripts/load-dummy-data.js.
 *
 * Usage:  node scripts/backup-data.js
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const TABLES = [
  'clients',
  'task_definitions',
  'projects',
  'project_contacts',
  'project_staff_rates',
  'project_tasks',
  'task_assignments',
  'task_items',
  'task_item_assignments',
  'quotes',
  'quote_items',
  'invoices',
  'invoice_items',
  'time_entries',
  'documents',
  'purchase_orders',
];

async function fetchAll(table) {
  // Paginate to avoid Supabase's default 1000-row cap
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await sb.from(table).select('*').range(from, from + pageSize - 1);
    if (error) {
      // Skip tables that don't exist yet (migration not applied)
      if (/schema cache|does not exist/i.test(error.message)) return null;
      throw new Error(`${table}: ${error.message}`);
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

(async () => {
  console.log('Backing up from', url);
  const backup = { version: 3, exported_at: new Date().toISOString() };
  for (const t of TABLES) {
    const rows = await fetchAll(t);
    if (rows === null) {
      console.log(`  ${t}: (table missing, skipped)`);
      continue;
    }
    backup[t] = rows;
    console.log(`  ${t}: ${rows.length}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(__dirname, '..', 'reference', `dlcs-backup-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(backup, null, 2), 'utf8');
  console.log('\nWrote', outFile);
})().catch(err => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
