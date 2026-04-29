#!/usr/bin/env node
/**
 * Stage 1 of the WFM import pipeline.
 *
 * Reads the 5 WorkflowMax CSV exports from a batch folder and
 * loads them verbatim into the wfm_*_raw staging tables in
 * Supabase. No transformation, no filtering.
 *
 * Usage:
 *   node scripts/wfm/01-load-staging.js <batch_folder>
 *
 * Example:
 *   node scripts/wfm/01-load-staging.js scripts/wfm/data/2026-04-28
 *
 * Behaviour:
 *   * Detects which file is which by filename pattern.
 *   * Generates a fresh batch_id per run.
 *   * Truncates *all* staging tables before loading
 *     (single source of truth — last run wins).
 *   * Logs counts per file to wfm_import_log.
 *
 * Required env (in .env.staging.local OR .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Set WFM_ENV=staging (default) or WFM_ENV=production to choose
 * which env file to load.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');

// ── Load env ────────────────────────────────────────────────────
const envName = process.env.WFM_ENV || 'staging';
const envFile = envName === 'production' ? '.env.local' : '.env.staging.local';
const envPath = path.join(__dirname, '..', '..', envFile);
if (!fs.existsSync(envPath)) {
  console.error(`Env file not found: ${envPath}`);
  console.error(`Set WFM_ENV=production to use .env.local instead.`);
  process.exit(1);
}
fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m) return;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(`Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${envFile}`);
  process.exit(1);
}

console.log(`▶ WFM staging loader   env=${envName}   target=${url}`);

// ── Resolve batch folder ────────────────────────────────────────
const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/wfm/01-load-staging.js <batch_folder>');
  process.exit(1);
}
const batchFolder = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
if (!fs.existsSync(batchFolder) || !fs.statSync(batchFolder).isDirectory()) {
  console.error(`Batch folder not found: ${batchFolder}`);
  process.exit(1);
}

// ── File pattern detection ──────────────────────────────────────
// Order matters: more specific patterns first.
const FILE_PATTERNS = [
  { test: (n) => /invoiced[_\s-]*time/i.test(n),  table: 'wfm_invoiced_time_raw', label: 'invoiced_time' },
  { test: (n) => /invoice[_\s-]*report/i.test(n), table: 'wfm_invoices_raw',      label: 'invoices' },
  { test: (n) => /\bjobs?\b/i.test(n),            table: 'wfm_jobs_raw',          label: 'jobs' },
  { test: (n) => /\btime[_\s-]*report\b/i.test(n),table: 'wfm_time_raw',          label: 'time' },
  { test: (n) => /client[_\s-]*report/i.test(n),  table: 'wfm_clients_raw',       label: 'clients' },
];

function classifyFile(filename) {
  for (const p of FILE_PATTERNS) if (p.test(filename)) return p;
  return null;
}

// ── Helpers ─────────────────────────────────────────────────────
function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function blankToNull(v) {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

// Pull a denormalized field from a raw row by trying several
// possible WFM column names (they vary slightly between reports).
function pick(row, ...keys) {
  for (const k of keys) {
    if (k in row) {
      const v = blankToNull(row[k]);
      if (v !== null) return v;
    }
  }
  return null;
}

// Per-table denormalization: extract the convenience columns we
// indexed in the staging schema.
const DENORMALIZE = {
  wfm_clients_raw: (row) => ({
    client_name: pick(row, '[Client] Client'),
    contact_name: pick(row, '[Contact] Contact'),
  }),
  wfm_jobs_raw: (row) => ({
    job_no: pick(row, '[Job] Job No.'),
    client_name: pick(row, '[Client] Client', '[Job] Client'),
    job_status: pick(row, '[Job] Status'),
    date_created: pick(row, '[Job] Date Created'),
  }),
  wfm_time_raw: (row) => ({
    job_no: pick(row, '[Job] Job No.'),
    staff_name: pick(row, '[Staff] Name'),
    time_date: pick(row, '[Time] Date'),
  }),
  wfm_invoiced_time_raw: (row) => ({
    invoice_no: pick(row, '[Invoice] Invoice No.'),
    job_no: pick(row, '[Job] Job No.'),
    staff_name: pick(row, '[Staff] Name'),
    time_date: pick(row, '[Invoice Time] Date'),
  }),
  wfm_invoices_raw: (row) => ({
    invoice_no: pick(row, '[Invoice] Invoice No.'),
    job_numbers: pick(row, '[Invoice] Job Number(s)'),
    client_name: pick(row, '[Invoice] Client', '[Client] Client'),
    invoice_date: pick(row, '[Invoice] Date'),
  }),
};

// ── Run ─────────────────────────────────────────────────────────
const sb = createClient(url, key, { auth: { persistSession: false } });
const batchId = crypto.randomUUID();

async function logEvent(stage, step, status, message, rowCount, details) {
  const { error } = await sb.from('wfm_import_log').insert({
    batch_id: batchId,
    stage,
    step,
    status,
    message,
    row_count: rowCount,
    details: details || null,
  });
  if (error) console.error(`  ⚠ failed to write log: ${error.message}`);
}

async function truncateStaging() {
  const tables = [
    'wfm_clients_raw',
    'wfm_jobs_raw',
    'wfm_time_raw',
    'wfm_invoiced_time_raw',
    'wfm_invoices_raw',
  ];
  for (const t of tables) {
    const { error } = await sb.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error(`  ✗ truncate ${t}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`  ✓ truncated ${tables.length} staging tables`);
}

async function loadFile(filePath, classification) {
  const filename = path.basename(filePath);
  console.log(`\n▶ ${filename}  →  ${classification.table}`);

  const text = stripBom(fs.readFileSync(filePath, 'utf8'));
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: false,
  });
  console.log(`  parsed ${rows.length} rows`);

  if (rows.length === 0) {
    await logEvent('load', classification.label, 'warn', 'empty file', 0);
    return;
  }

  const denorm = DENORMALIZE[classification.table];
  const records = rows.map((r, i) => ({
    batch_id: batchId,
    row_num: i + 1,
    raw: r,
    ...denorm(r),
  }));

  // Insert in chunks (Supabase has a payload size limit).
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const { error } = await sb.from(classification.table).insert(chunk);
    if (error) {
      console.error(`  ✗ insert failed at row ${i}: ${error.message}`);
      await logEvent('load', classification.label, 'error', error.message, inserted, {
        file: filename,
        failed_at_row: i,
      });
      process.exit(1);
    }
    inserted += chunk.length;
    process.stdout.write(`  inserted ${inserted}/${records.length}\r`);
  }
  console.log(`  ✓ inserted ${inserted} rows`);
  await logEvent('load', classification.label, 'ok', `loaded ${filename}`, inserted, {
    file: filename,
  });
}

async function main() {
  console.log(`▶ batch_id = ${batchId}`);
  console.log(`▶ batch folder = ${batchFolder}\n`);

  const allFiles = fs.readdirSync(batchFolder).filter((f) => f.toLowerCase().endsWith('.csv'));
  if (allFiles.length === 0) {
    console.error('No CSV files in batch folder.');
    process.exit(1);
  }

  const matched = [];
  const unmatched = [];
  const seenTables = new Set();
  for (const f of allFiles) {
    const c = classifyFile(f);
    if (!c) {
      unmatched.push(f);
      continue;
    }
    if (seenTables.has(c.table)) {
      console.error(`✗ Two files match ${c.table}: pick one and remove the other from the batch folder.`);
      process.exit(1);
    }
    seenTables.add(c.table);
    matched.push({ file: f, classification: c });
  }

  if (unmatched.length) {
    console.warn(`⚠ Skipping unrecognized files: ${unmatched.join(', ')}`);
  }
  if (matched.length === 0) {
    console.error('No recognized CSV files matched.');
    process.exit(1);
  }

  console.log(`▶ matched ${matched.length} files:`);
  for (const m of matched) console.log(`    ${m.classification.label.padEnd(15)} ${m.file}`);
  console.log('');

  console.log('▶ truncating staging tables...');
  await truncateStaging();

  for (const m of matched) {
    await loadFile(path.join(batchFolder, m.file), m.classification);
  }

  console.log(`\n✓ done. batch_id = ${batchId}`);
  console.log(`  Inspect with:  SELECT * FROM wfm_import_log WHERE batch_id = '${batchId}';`);
}

main().catch((err) => {
  console.error('\n✗ unhandled error:', err);
  process.exit(1);
});
