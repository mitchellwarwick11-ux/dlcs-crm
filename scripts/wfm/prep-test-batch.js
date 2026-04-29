#!/usr/bin/env node
/**
 * One-off helper: reads the 5 full WFM CSV exports, picks ~50
 * diverse job numbers, and writes filtered CSVs into a test
 * batch folder ready for `npm run wfm:load`.
 *
 * Diversity targets:
 *   * Mix of [Job] Status (Completed, In Progress, etc.)
 *   * Mix of [Job] Fixed Fee / Hourly Rates
 *   * Mix of [Job] Date Created (recent + older)
 *   * Mix of jobs with/without invoices and time entries
 *
 * Usage:
 *   node scripts/wfm/prep-test-batch.js <source_folder> <out_folder> [count]
 *
 * Example:
 *   node scripts/wfm/prep-test-batch.js \
 *     "C:/Users/MitchWarwick/Downloads" \
 *     "scripts/wfm/data/2026-04-28-test" \
 *     50
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const SOURCE = process.argv[2];
const OUT = process.argv[3];
const TARGET_COUNT = parseInt(process.argv[4] || '50', 10);

if (!SOURCE || !OUT) {
  console.error('Usage: node scripts/wfm/prep-test-batch.js <source_folder> <out_folder> [count]');
  process.exit(1);
}

function stripBom(s) { return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s; }

function readCsv(filePath) {
  const text = stripBom(fs.readFileSync(filePath, 'utf8'));
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });
}

function writeCsv(filePath, rows) {
  if (rows.length === 0) {
    fs.writeFileSync(filePath, '');
    return;
  }
  const headers = Object.keys(rows[0]);
  const out = stringify(rows, { header: true, columns: headers, quoted_string: true });
  fs.writeFileSync(filePath, out);
}

const PATTERNS = {
  jobs:           /Jobs.*\.csv$/i,
  time:           /^(?!.*Invoiced).*Time[_\s-]*Report.*\.csv$/i,
  invoicedTime:   /Invoiced[_\s-]*Time[_\s-]*Report.*\.csv$/i,
  invoices:       /^(?!.*Invoiced).*Invoice[_\s-]*Report.*\.csv$/i,
  clients:        /Client[_\s-]*Report.*\.csv$/i,
};

function findFile(label, pattern) {
  const all = fs.readdirSync(SOURCE);
  const matches = all.filter((f) => pattern.test(f));
  if (matches.length === 0) {
    console.error(`Could not find ${label} CSV in ${SOURCE}`);
    process.exit(1);
  }
  // Prefer files containing "AppData" over older "_MW" vintages when both exist.
  const appData = matches.filter((f) => /AppData/i.test(f));
  const chosen = appData.length > 0 ? appData[0] : matches[0];
  return path.join(SOURCE, chosen);
}

const jobsPath         = findFile('jobs', PATTERNS.jobs);
const timePath         = findFile('time', PATTERNS.time);
const invoicedTimePath = findFile('invoiced time', PATTERNS.invoicedTime);
const invoicesPath     = findFile('invoices', PATTERNS.invoices);
const clientsPath      = findFile('clients', PATTERNS.clients);

console.log('Source files:');
console.log('  jobs          ', path.basename(jobsPath));
console.log('  time          ', path.basename(timePath));
console.log('  invoiced_time ', path.basename(invoicedTimePath));
console.log('  invoices      ', path.basename(invoicesPath));
console.log('  clients       ', path.basename(clientsPath));
console.log('');

// ── Load jobs and pick diverse subset ──────────────────────────
const allJobs = readCsv(jobsPath);
console.log(`Total jobs in source: ${allJobs.length}`);

function parseDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})-(\w{3})-(\d{2,4})$/);
  if (!m) return null;
  const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  return new Date(year, months[m[2]] || 0, parseInt(m[1], 10));
}

function bucketKey(job) {
  const status = (job['[Job] Status'] || 'unknown').trim();
  const fee = (job['[Job] Fixed Fee / Hourly Rates'] || 'unknown').trim();
  const created = parseDate(job['[Job] Date Created']);
  let era = 'old';
  if (created) {
    const y = created.getFullYear();
    if (y >= 2024) era = 'recent';
    else if (y >= 2022) era = 'mid';
  }
  const hasInvoice = (job['[Job] Has Invoice?'] || '').trim() === 'Yes' ? 'inv' : 'noinv';
  return [status, fee, era, hasInvoice].join('|');
}

// Group jobs by bucket
const buckets = new Map();
for (const j of allJobs) {
  const k = bucketKey(j);
  if (!buckets.has(k)) buckets.set(k, []);
  buckets.get(k).push(j);
}
console.log(`Distinct buckets: ${buckets.size}`);

// Round-robin pick from each bucket so coverage is even
const picked = [];
const bucketArrays = [...buckets.values()];
let idx = 0;
while (picked.length < TARGET_COUNT && bucketArrays.some((b) => b.length > 0)) {
  const bucket = bucketArrays[idx % bucketArrays.length];
  if (bucket.length > 0) picked.push(bucket.shift());
  idx++;
}

const pickedJobNos = new Set(picked.map((j) => (j['[Job] Job No.'] || '').trim()).filter(Boolean));
const pickedClientNames = new Set(picked.map((j) => (j['[Client] Client'] || '').trim()).filter(Boolean));

console.log(`\nPicked ${picked.length} jobs across ${pickedClientNames.size} clients.`);
console.log('Bucket distribution:');
const finalBuckets = new Map();
for (const j of picked) {
  const k = bucketKey(j);
  finalBuckets.set(k, (finalBuckets.get(k) || 0) + 1);
}
for (const [k, n] of [...finalBuckets.entries()].sort((a,b) => b[1]-a[1])) {
  console.log(`  ${String(n).padStart(2)}  ${k}`);
}

// ── Filter the other files ──────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true });

const allTime = readCsv(timePath);
const filteredTime = allTime.filter((r) => pickedJobNos.has((r['[Job] Job No.'] || '').trim()));

const allInvoicedTime = readCsv(invoicedTimePath);
const filteredInvoicedTime = allInvoicedTime.filter((r) => pickedJobNos.has((r['[Job] Job No.'] || '').trim()));

const allInvoices = readCsv(invoicesPath);
// Invoice can reference multiple jobs in [Invoice] Job Number(s) (comma-separated)
const filteredInvoices = allInvoices.filter((r) => {
  const jobNos = (r['[Invoice] Job Number(s)'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return jobNos.some((n) => pickedJobNos.has(n));
});

const allClients = readCsv(clientsPath);
const filteredClients = allClients.filter((r) => pickedClientNames.has((r['[Client] Client'] || '').trim()));

writeCsv(path.join(OUT, 'jobs.csv'),          picked);
writeCsv(path.join(OUT, 'time_report.csv'),   filteredTime);
writeCsv(path.join(OUT, 'invoiced_time_report.csv'), filteredInvoicedTime);
writeCsv(path.join(OUT, 'invoice_report.csv'),filteredInvoices);
writeCsv(path.join(OUT, 'client_report.csv'), filteredClients);

console.log('\nWrote filtered files:');
console.log(`  jobs.csv                 ${picked.length} rows`);
console.log(`  time_report.csv          ${filteredTime.length} rows`);
console.log(`  invoiced_time_report.csv ${filteredInvoicedTime.length} rows`);
console.log(`  invoice_report.csv       ${filteredInvoices.length} rows`);
console.log(`  client_report.csv        ${filteredClients.length} rows`);
console.log(`\nDone. Output: ${OUT}`);
