#!/usr/bin/env node
/**
 * Loads a backup/dummy-data JSON file into Supabase using upsert.
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/load-data.js                                # defaults to reference/dlcs-dummy-data.json
 *   node scripts/load-data.js reference/dlcs-backup-2026-04-19.json
 *   node scripts/load-data.js C:/absolute/path/to/backup.json
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
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

// ── Resolve input file ──────────────────────────────────────────
const arg = process.argv[2];
const inputPath = arg
  ? (path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg))
  : path.join(__dirname, '..', 'reference', 'dlcs-dummy-data.json');

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const sb = createClient(url, key, { auth: { persistSession: false } });

// FK-safe insert order. `amount` is stripped because it's a generated column.
const TABLES = [
  { name: 'clients' },
  { name: 'task_definitions' },
  { name: 'projects' },
  { name: 'project_contacts' },
  { name: 'project_staff_rates' },
  { name: 'project_tasks' },
  { name: 'task_assignments' },
  { name: 'task_items' },
  { name: 'task_item_assignments' },
  { name: 'quotes' },
  { name: 'quote_items',   strip: ['amount'] },
  { name: 'invoices' },
  { name: 'invoice_items', strip: ['amount'] },
  // time_entries last so invoice_item_id FKs resolve
  { name: 'time_entries' },
  { name: 'documents' },
  { name: 'purchase_orders' },
];

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

async function upsertTable(name, rows, strip) {
  if (!rows || rows.length === 0) { console.log(`  ${name}: (empty, skipped)`); return; }
  const cleaned = strip
    ? rows.map(r => { const c = { ...r }; strip.forEach(k => delete c[k]); return c; })
    : rows;
  let inserted = 0;
  for (const batch of chunk(cleaned, 500)) {
    const { error } = await sb.from(name).upsert(batch, { onConflict: 'id' });
    if (error) {
      // Tolerate missing tables (migration not applied) — only if it's a schema-level error
      if (/schema cache|does not exist/i.test(error.message)) {
        console.log(`  ${name}: (table missing, skipped)`);
        return;
      }
      console.error(`  ${name}: FAILED — ${error.message}`);
      throw error;
    }
    inserted += batch.length;
  }
  console.log(`  ${name}: ${inserted} rows upserted`);
}

(async () => {
  console.log(`Loading ${path.relative(process.cwd(), inputPath)} into ${url}`);
  for (const t of TABLES) {
    await upsertTable(t.name, data[t.name], t.strip);
  }
  console.log('Done.');
})().catch(err => {
  console.error('\nLoad aborted:', err.message);
  process.exit(1);
});
