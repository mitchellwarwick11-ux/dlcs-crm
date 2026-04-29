#!/usr/bin/env node
/**
 * Stage 1.5 of the WFM import pipeline: validation.
 *
 * Reads from the wfm_*_raw staging tables (latest batch unless
 * --batch-id is provided), runs a suite of data-quality checks
 * in memory, and prints a report. Writes summary rows to
 * wfm_import_log for audit.
 *
 * Usage:
 *   node scripts/wfm/02-validate.js
 *   node scripts/wfm/02-validate.js --batch-id <uuid>
 *
 * Required env: same as 01-load-staging.js.
 *
 * Severity:
 *   ERROR  - will cause Stage 2 to drop or mis-link rows
 *   WARN   - data quality issue worth reviewing
 *   INFO   - sanity check / count
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');

// ── Load env ────────────────────────────────────────────────────
const envName = process.env.WFM_ENV || 'staging';
const envFile = envName === 'production' ? '.env.local' : '.env.staging.local';
const envPath = path.join(__dirname, '..', '..', envFile);
fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m) return;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

// ── Args ────────────────────────────────────────────────────────
let batchIdArg = null;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--batch-id') batchIdArg = process.argv[++i];
}

// ── Helpers ─────────────────────────────────────────────────────
function readCsvIfExists(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    comment: '#',
    relax_quotes: true,
  });
}

function norm(s) {
  return s ? String(s).trim() : '';
}

async function fetchAll(table, batchId) {
  const all = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .eq('batch_id', batchId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function uniqueSorted(arr) {
  return [...new Set(arr)].filter(Boolean).sort();
}

function setDiff(a, b) {
  const setB = new Set(b);
  return a.filter((x) => !setB.has(x));
}

// ── Check report formatting ─────────────────────────────────────
const checks = [];

function check({ name, severity, count, total, sample, note }) {
  checks.push({ name, severity, count, total, sample: sample || [], note });
}

function printReport() {
  const widths = { sev: 5, count: 8, name: 60 };
  const sevColor = { ERROR: '\x1b[31m', WARN: '\x1b[33m', INFO: '\x1b[36m', OK: '\x1b[32m' };
  const reset = '\x1b[0m';

  console.log('');
  console.log('─'.repeat(90));
  console.log('  VALIDATION REPORT');
  console.log('─'.repeat(90));

  for (const c of checks) {
    const sev = c.severity.padEnd(widths.sev);
    const color = sevColor[c.severity] || '';
    const countStr = c.total != null
      ? `${c.count}/${c.total}`.padStart(widths.count)
      : String(c.count).padStart(widths.count);
    console.log(`  ${color}${sev}${reset}  ${countStr}   ${c.name}`);
    if (c.note) console.log(`              ${c.note}`);
    if (c.sample && c.sample.length > 0) {
      const shown = c.sample.slice(0, 5);
      for (const s of shown) console.log(`              · ${s}`);
      if (c.sample.length > 5) console.log(`              · …and ${c.sample.length - 5} more`);
    }
  }

  console.log('─'.repeat(90));
  const errors = checks.filter((c) => c.severity === 'ERROR' && c.count > 0).length;
  const warns = checks.filter((c) => c.severity === 'WARN' && c.count > 0).length;
  console.log(`  ${errors} error(s), ${warns} warning(s)`);
  console.log('─'.repeat(90));
  return { errors, warns };
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(`▶ WFM validate   env=${envName}   target=${url}`);

  // Resolve batch
  let batchId = batchIdArg;
  if (!batchId) {
    const { data, error } = await sb
      .from('wfm_jobs_raw')
      .select('batch_id, imported_at')
      .order('imported_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) {
      console.error('No batches found in wfm_jobs_raw. Run 01-load-staging first.');
      process.exit(1);
    }
    batchId = data[0].batch_id;
  }
  console.log(`▶ batch_id = ${batchId}\n  fetching staging data...`);

  const [clients, jobs, time, invTime, invoices] = await Promise.all([
    fetchAll('wfm_clients_raw', batchId),
    fetchAll('wfm_jobs_raw', batchId),
    fetchAll('wfm_time_raw', batchId),
    fetchAll('wfm_invoiced_time_raw', batchId),
    fetchAll('wfm_invoices_raw', batchId),
  ]);

  console.log(`  clients=${clients.length} jobs=${jobs.length} time=${time.length} invoiced_time=${invTime.length} invoices=${invoices.length}`);

  // ── Sets for cross-table joins ──────────────────────────────
  const jobNos = new Set(jobs.map((j) => norm(j.job_no)).filter(Boolean));
  const invoiceNos = new Set(invoices.map((i) => norm(i.invoice_no)).filter(Boolean));
  const clientNames = new Set(clients.map((c) => norm(c.client_name)).filter(Boolean));

  // INFO: row counts
  check({ name: 'Row counts', severity: 'INFO', count: jobs.length,
    note: `clients=${clients.length}  jobs=${jobs.length}  time=${time.length}  invoiced_time=${invTime.length}  invoices=${invoices.length}` });

  // ── 1. Empty key fields ─────────────────────────────────────
  const jobsNoNumber = jobs.filter((j) => !norm(j.job_no));
  check({
    name: 'Jobs with empty Job No.',
    severity: jobsNoNumber.length > 0 ? 'ERROR' : 'OK',
    count: jobsNoNumber.length,
    total: jobs.length,
    sample: jobsNoNumber.slice(0, 5).map((j) => `row ${j.row_num}: ${norm(j.client_name) || '(no client)'}`),
  });

  const invoicesNoNumber = invoices.filter((i) => !norm(i.invoice_no));
  check({
    name: 'Invoices with empty Invoice No.',
    severity: invoicesNoNumber.length > 0 ? 'ERROR' : 'OK',
    count: invoicesNoNumber.length,
    total: invoices.length,
  });

  const clientsNoName = clients.filter((c) => !norm(c.client_name));
  check({
    name: 'Clients with empty Client name',
    severity: clientsNoName.length > 0 ? 'ERROR' : 'OK',
    count: clientsNoName.length,
    total: clients.length,
  });

  // ── 2. Duplicate job numbers ────────────────────────────────
  const jobCounts = {};
  for (const j of jobs) {
    const k = norm(j.job_no);
    if (!k) continue;
    jobCounts[k] = (jobCounts[k] || 0) + 1;
  }
  const dupJobs = Object.entries(jobCounts).filter(([, n]) => n > 1);
  check({
    name: 'Duplicate Job No. in jobs export',
    severity: dupJobs.length > 0 ? 'ERROR' : 'OK',
    count: dupJobs.length,
    sample: dupJobs.slice(0, 5).map(([k, n]) => `${k} × ${n}`),
  });

  // ── 3. Orphan references ────────────────────────────────────
  const timeJobNos = uniqueSorted(time.map((t) => norm(t.job_no)));
  const orphanTimeJobs = setDiff(timeJobNos, [...jobNos]);
  check({
    name: 'Time entries referencing job not in jobs export',
    severity: orphanTimeJobs.length > 0 ? 'WARN' : 'OK',
    count: orphanTimeJobs.length,
    sample: orphanTimeJobs.slice(0, 5),
    note: orphanTimeJobs.length > 0 ? 'These rows will be dropped during transform.' : null,
  });

  const invTimeJobNos = uniqueSorted(invTime.map((t) => norm(t.job_no)));
  const orphanInvTimeJobs = setDiff(invTimeJobNos, [...jobNos]);
  check({
    name: 'Invoiced-time rows referencing job not in jobs export',
    severity: orphanInvTimeJobs.length > 0 ? 'WARN' : 'OK',
    count: orphanInvTimeJobs.length,
    sample: orphanInvTimeJobs.slice(0, 5),
  });

  const invTimeInvNos = uniqueSorted(invTime.map((t) => norm(t.invoice_no)));
  const orphanInvTimeInvoices = setDiff(invTimeInvNos, [...invoiceNos]);
  check({
    name: 'Invoiced-time rows referencing invoice not in invoice export',
    severity: orphanInvTimeInvoices.length > 0 ? 'ERROR' : 'OK',
    count: orphanInvTimeInvoices.length,
    sample: orphanInvTimeInvoices.slice(0, 5),
    note: orphanInvTimeInvoices.length > 0 ? 'time→invoice link cannot be reconstructed for these.' : null,
  });

  // Invoices with job_numbers referencing missing jobs (multi-job invoices possible)
  const orphanInvoiceJobs = new Set();
  for (const inv of invoices) {
    const jobNumbers = norm(inv.job_numbers).split(',').map(norm).filter(Boolean);
    for (const jn of jobNumbers) if (!jobNos.has(jn)) orphanInvoiceJobs.add(jn);
  }
  check({
    name: 'Invoices referencing job not in jobs export',
    severity: orphanInvoiceJobs.size > 0 ? 'WARN' : 'OK',
    count: orphanInvoiceJobs.size,
    sample: [...orphanInvoiceJobs].slice(0, 5),
    note: 'Often happens when the invoice covers multiple jobs and only some were sampled.',
  });

  // Jobs whose client isn't in client export
  const jobClientNames = uniqueSorted(jobs.map((j) => norm(j.client_name)));
  const orphanJobClients = setDiff(jobClientNames, [...clientNames]);
  check({
    name: 'Jobs referencing client not in client export',
    severity: orphanJobClients.length > 0 ? 'ERROR' : 'OK',
    count: orphanJobClients.length,
    sample: orphanJobClients.slice(0, 5),
  });

  // ── 4. Mapping coverage ─────────────────────────────────────
  const mappingsDir = path.join(__dirname, 'mappings');
  const categoryMap = readCsvIfExists(path.join(mappingsDir, 'category_to_job_type.csv'));
  const statusMap = readCsvIfExists(path.join(mappingsDir, 'status_to_project_status.csv'));
  const staffMap = readCsvIfExists(path.join(mappingsDir, 'staff_name_to_email.csv'));

  const knownCategories = new Set(categoryMap.map((r) => norm(r.wfm_category)));
  const jobCategories = uniqueSorted(jobs.map((j) => norm(j.raw['[Category] Category'])).filter(Boolean));
  const unmappedCategories = jobCategories.filter((c) => !knownCategories.has(c));
  check({
    name: 'Job categories not in category_to_job_type.csv',
    severity: unmappedCategories.length > 0 ? 'WARN' : 'OK',
    count: unmappedCategories.length,
    sample: unmappedCategories,
    note: unmappedCategories.length > 0 ? 'Will fall through to job_type=other in transform.' : null,
  });

  const knownStatuses = new Set(statusMap.map((r) => norm(r.wfm_status)));
  const jobStatuses = uniqueSorted(jobs.map((j) => norm(j.job_status)).filter(Boolean));
  const unmappedStatuses = jobStatuses.filter((s) => !knownStatuses.has(s));
  check({
    name: 'Job statuses not in status_to_project_status.csv',
    severity: unmappedStatuses.length > 0 ? 'ERROR' : 'OK',
    count: unmappedStatuses.length,
    sample: unmappedStatuses,
  });

  const knownStaff = new Set(staffMap.map((r) => norm(r.wfm_staff_name)));
  const allStaffNames = uniqueSorted([
    ...time.map((t) => norm(t.staff_name)),
    ...invTime.map((t) => norm(t.staff_name)),
  ].filter(Boolean));
  const unmappedStaff = allStaffNames.filter((s) => !knownStaff.has(s));
  check({
    name: 'Staff names not in staff_name_to_email.csv',
    severity: unmappedStaff.length > 0 ? 'WARN' : 'OK',
    count: unmappedStaff.length,
    total: allStaffNames.length,
    sample: unmappedStaff.slice(0, 10),
    note: unmappedStaff.length > 0 ? 'Time entries for unmapped staff will be flagged in transform.' : null,
  });

  // ── 5. Time entry sanity ────────────────────────────────────
  function parseHours(s) {
    if (!s) return null;
    const n = parseFloat(String(s).replace(/,/g, ''));
    return isNaN(n) ? null : n;
  }
  const zeroHours = time.filter((t) => {
    const h = parseHours(t.raw['[Time] Time']);
    return h === 0;
  });
  check({
    name: 'Time entries with 0 hours',
    severity: 'INFO',
    count: zeroHours.length,
    total: time.length,
    note: 'Common for placeholder rows; transform will skip.',
  });

  const negHours = time.filter((t) => {
    const h = parseHours(t.raw['[Time] Time']);
    return h !== null && h < 0;
  });
  check({
    name: 'Time entries with negative hours',
    severity: negHours.length > 0 ? 'WARN' : 'OK',
    count: negHours.length,
    sample: negHours.slice(0, 5).map((t) => `${norm(t.job_no)} ${norm(t.staff_name)} ${norm(t.time_date)} (${t.raw['[Time] Time']}h)`),
  });

  // ── 6. Billed flag vs invoiced-time presence ────────────────
  function timeKey(jobNo, staff, date, note) {
    return [jobNo, staff, date, norm(note)].map(norm).join('|');
  }
  const invTimeKeys = new Set(invTime.map((t) => timeKey(t.job_no, t.staff_name, t.time_date, t.raw['[Invoice Time] Note'])));
  // [Time] Billed? values seen in WFM: 'Yes', 'No', 'Yes - Written Off',
  // 'Yes - Written On', 'No - Written Off'. We treat any starting with 'Yes' as billed.
  const isBilled = (t) => /^yes\b/i.test(norm(t.raw['[Time] Billed?']));
  const billedYesNoMatch = time.filter((t) => {
    if (!isBilled(t)) return false;
    return !invTimeKeys.has(timeKey(t.job_no, t.staff_name, t.time_date, t.raw['[Time] Note']));
  });
  check({
    name: 'Time marked Billed=Yes with no matching invoiced-time row',
    severity: billedYesNoMatch.length > 0 ? 'WARN' : 'OK',
    count: billedYesNoMatch.length,
    total: time.filter(isBilled).length,
    sample: billedYesNoMatch.slice(0, 5).map((t) => `${norm(t.job_no)} ${norm(t.staff_name)} ${norm(t.time_date)}`),
    note: billedYesNoMatch.length > 0 ? 'These will import without invoice link. Likely WFM data drift or orphan invoices.' : null,
  });

  // ── 7. Per-invoice sum check ────────────────────────────────
  function parseAmount(s) {
    if (!s) return 0;
    const n = parseFloat(String(s).replace(/[,$]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  const sumByInvoice = {};
  for (const t of invTime) {
    const inv = norm(t.invoice_no);
    if (!inv) continue;
    sumByInvoice[inv] = (sumByInvoice[inv] || 0) + parseAmount(t.raw['[Invoice Time] Invoiced Amount']);
  }
  const invoiceMismatch = [];
  for (const inv of invoices) {
    const no = norm(inv.invoice_no);
    if (!no) continue;
    const sumTime = sumByInvoice[no] || 0;
    const tasksInvoiced = parseAmount(inv.raw['[Invoice] Tasks Invoiced']);
    if (tasksInvoiced > 0 && Math.abs(sumTime - tasksInvoiced) > 0.5 && sumTime > 0) {
      invoiceMismatch.push(`${no}: time=$${sumTime.toFixed(2)} vs tasks=$${tasksInvoiced.toFixed(2)}`);
    }
  }
  check({
    name: 'Invoice sum mismatch (Σ invoiced time ≠ [Invoice] Tasks Invoiced)',
    severity: invoiceMismatch.length > 0 ? 'WARN' : 'OK',
    count: invoiceMismatch.length,
    sample: invoiceMismatch.slice(0, 5),
    note: invoiceMismatch.length > 0 ? 'Indicates fixed-fee/cost components that need synthetic line items.' : null,
  });

  // ── Print + log ─────────────────────────────────────────────
  const { errors, warns } = printReport();
  await sb.from('wfm_import_log').insert({
    batch_id: batchId,
    stage: 'validate',
    step: 'summary',
    status: errors > 0 ? 'error' : warns > 0 ? 'warn' : 'ok',
    message: `${errors} error(s), ${warns} warning(s)`,
    details: { checks: checks.map((c) => ({ name: c.name, severity: c.severity, count: c.count })) },
  });

  process.exit(errors > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error('\n✗ unhandled error:', err);
  process.exit(1);
});
