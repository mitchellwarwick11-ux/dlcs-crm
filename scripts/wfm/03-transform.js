#!/usr/bin/env node
/**
 * Stage 2 of the WFM import pipeline: transform.
 *
 * Reads from wfm_*_raw staging tables (latest batch unless
 * --batch-id is provided), applies import-config.js filters,
 * and upserts into the live app tables.
 *
 * Idempotent: every imported row carries a wfm_legacy_id and
 * upserts use ON CONFLICT on that column.
 *
 * Order of operations:
 *   1.  Resolve target jobs (cutoffDate + always-include/exclude)
 *   2.  Resolve target clients (any client owning a target job)
 *   3.  Build staff lookup (mapping CSV → staff_profiles by email)
 *   4.  Upsert clients
 *   5.  Upsert client_contacts
 *   6.  Upsert projects
 *   7.  Upsert time_entries
 *   8.  Upsert invoices
 *   9.  Upsert invoice_items (grouped time lines + synthetic
 *       fixed-fee/cost lines for sum-mismatch invoices)
 *   10. Link time_entries.invoice_item_id
 *
 * Usage:
 *   node scripts/wfm/03-transform.js
 *   node scripts/wfm/03-transform.js --batch-id <uuid>
 *   node scripts/wfm/03-transform.js --dry-run
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
const importConfig = require('./import-config');

// ── Load env ────────────────────────────────────────────────────
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

// ── Args ────────────────────────────────────────────────────────
let batchIdArg = null;
let dryRun = false;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--batch-id') batchIdArg = process.argv[++i];
  else if (a === '--dry-run') dryRun = true;
}

// ── Helpers ─────────────────────────────────────────────────────
function norm(s) { return s ? String(s).trim() : ''; }
function blank(s) { return norm(s) || null; }

function parseAmount(s) {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/[,$]/g, ''));
  return isNaN(n) ? null : n;
}

function parseHours(s) {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

const MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
function parseWfmDate(s) {
  // Handles 3-Aug-15, 13-Dec-2024, 28-Sep-2017
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2})-(\w{3})-(\d{2,4})$/);
  if (!m) return null;
  let year = parseInt(m[3], 10);
  if (year < 100) year += year < 50 ? 2000 : 1900;
  const month = MONTHS[m[2]];
  if (month == null) return null;
  const day = parseInt(m[1], 10);
  // Return YYYY-MM-DD string for DATE column
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function readMapping(filePath, keyCol, valCol) {
  if (!fs.existsSync(filePath)) return new Map();
  const text = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  const rows = parse(text, { columns: true, skip_empty_lines: true, comment: '#', relax_quotes: true });
  const map = new Map();
  for (const r of rows) {
    const k = norm(r[keyCol]);
    const v = norm(r[valCol]);
    if (k && v) map.set(k, v);
  }
  return map;
}

async function fetchAll(table, batchId) {
  const all = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb.from(table).select('*').eq('batch_id', batchId).range(from, from + PAGE - 1);
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function logEvent(batchId, step, status, message, rowCount, details) {
  await sb.from('wfm_import_log').insert({
    batch_id: batchId, stage: 'transform', step, status, message, row_count: rowCount, details,
  });
}

async function upsertChunked(table, rows, onConflict) {
  if (dryRun) {
    console.log(`    [dry-run] would upsert ${rows.length} rows into ${table}`);
    return rows.length;
  }
  if (rows.length === 0) return 0;
  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await sb.from(table).upsert(chunk, { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
    total += chunk.length;
  }
  return total;
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(`▶ WFM transform   env=${envName}   target=${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  if (dryRun) console.log('  ** DRY RUN — no writes will be made **');

  // Resolve batch
  let batchId = batchIdArg;
  if (!batchId) {
    const { data } = await sb.from('wfm_jobs_raw').select('batch_id, imported_at')
      .order('imported_at', { ascending: false }).limit(1);
    if (!data || !data.length) { console.error('No batches in staging.'); process.exit(1); }
    batchId = data[0].batch_id;
  }
  console.log(`▶ batch_id = ${batchId}\n`);

  console.log('▶ loading staging data...');
  const [clientsRaw, jobsRaw, timeRaw, invTimeRaw, invoicesRaw] = await Promise.all([
    fetchAll('wfm_clients_raw', batchId),
    fetchAll('wfm_jobs_raw', batchId),
    fetchAll('wfm_time_raw', batchId),
    fetchAll('wfm_invoiced_time_raw', batchId),
    fetchAll('wfm_invoices_raw', batchId),
  ]);
  console.log(`  clients=${clientsRaw.length} jobs=${jobsRaw.length} time=${timeRaw.length} invoiced_time=${invTimeRaw.length} invoices=${invoicesRaw.length}`);

  // ── 1. Resolve target jobs ──────────────────────────────────
  console.log('\n▶ resolving target jobs (filter via import-config)...');
  const cutoff = importConfig.cutoffDate ? new Date(importConfig.cutoffDate) : null;
  const alwaysIn = new Set((importConfig.alwaysIncludeJobNumbers || []).map(norm));
  const alwaysOut = new Set((importConfig.alwaysExcludeJobNumbers || []).map(norm));

  const targetJobs = jobsRaw.filter((j) => {
    const jobNo = norm(j.job_no);
    if (!jobNo) return false;
    if (alwaysOut.has(jobNo)) return false;
    if (alwaysIn.has(jobNo)) return true;
    if (!cutoff) return true;
    const created = parseWfmDate(j.date_created);
    if (!created) return false;
    return new Date(created) >= cutoff;
  });
  console.log(`  ${targetJobs.length}/${jobsRaw.length} jobs selected   (cutoff=${importConfig.cutoffDate || 'none'}  +${alwaysIn.size} always-in  -${alwaysOut.size} always-out)`);

  const targetJobNos = new Set(targetJobs.map((j) => norm(j.job_no)));
  if (targetJobNos.size === 0) {
    console.error('No jobs selected. Adjust import-config.js (cutoffDate or alwaysIncludeJobNumbers).');
    process.exit(1);
  }

  // ── 2. Resolve target clients ───────────────────────────────
  const targetClientNames = new Set(targetJobs.map((j) => norm(j.client_name)).filter(Boolean));
  const targetClients = clientsRaw.filter((c) => targetClientNames.has(norm(c.client_name)));
  // Multiple rows per client (one per contact); dedupe by name for the clients table
  const clientByName = new Map();
  for (const c of targetClients) {
    const name = norm(c.client_name);
    if (name && !clientByName.has(name)) clientByName.set(name, c);
  }
  console.log(`  ${clientByName.size} clients selected`);

  // ── 3. Build staff lookup ───────────────────────────────────
  console.log('\n▶ building staff lookup...');
  const staffNameToEmail = readMapping(path.join(__dirname, 'mappings', 'staff_name_to_email.csv'), 'wfm_staff_name', 'staff_email');

  const { data: profiles, error: pErr } = await sb.from('staff_profiles').select('id, email');
  if (pErr) throw pErr;
  const emailToProfileId = new Map(profiles.map((p) => [p.email.toLowerCase(), p.id]));

  const staffNameToProfileId = new Map();
  const missingStaffEmails = new Set();
  for (const [name, email] of staffNameToEmail) {
    const id = emailToProfileId.get(email.toLowerCase());
    if (id) staffNameToProfileId.set(name, id);
    else missingStaffEmails.add(email);
  }
  console.log(`  ${staffNameToProfileId.size}/${staffNameToEmail.size} staff names resolve to a profile`);
  if (missingStaffEmails.size > 0) {
    console.error(`  ✗ Missing staff_profiles for emails: ${[...missingStaffEmails].join(', ')}`);
    console.error(`    Create these auth users in Supabase Authentication → Users.`);
    process.exit(1);
  }

  // ── 4. Upsert clients ───────────────────────────────────────
  console.log('\n▶ upserting clients...');
  const categoryMap = readMapping(path.join(__dirname, 'mappings', 'category_to_job_type.csv'), 'wfm_category', 'job_type');
  const statusMap   = readMapping(path.join(__dirname, 'mappings', 'status_to_project_status.csv'), 'wfm_status', 'project_status');

  const clientRows = [...clientByName.values()].map((c) => {
    const r = c.raw;
    return {
      wfm_legacy_id: `wfm:client:${norm(c.client_name)}`,
      name: norm(c.client_name),
      company_name: norm(r['[Client] Type']) === 'Company' ? norm(c.client_name) : null,
      email: blank(r['[Client] Email']),
      phone: blank(r['[Client] Phone']),
      address_line1: blank(r['[Client] Address']),
      suburb: blank(r['[Client] Town/City']),
      state: blank(r['[Client] State/Region']) || 'QLD',
      postcode: blank(r['[Client] Post Code']),
      notes: blank(r['[Client] Billing Details']),
      is_active: norm(r['[Client] Status']) !== 'Archived',
    };
  });
  const upserted = await upsertChunked('clients', clientRows, 'wfm_legacy_id');
  console.log(`  ✓ upserted ${upserted} clients`);

  // Re-fetch to get IDs
  const { data: dbClients, error: dbcErr } = await sb.from('clients').select('id, wfm_legacy_id').not('wfm_legacy_id', 'is', null);
  if (dbcErr) throw dbcErr;
  const clientIdByLegacy = new Map(dbClients.map((c) => [c.wfm_legacy_id, c.id]));

  // ── 5. Upsert client_contacts ───────────────────────────────
  console.log('\n▶ upserting client_contacts...');
  const contactRows = [];
  for (const c of targetClients) {
    const contactName = blank(c.contact_name);
    if (!contactName) continue;
    const clientLegacy = `wfm:client:${norm(c.client_name)}`;
    const clientId = clientIdByLegacy.get(clientLegacy);
    if (!clientId) continue;
    const r = c.raw;
    contactRows.push({
      wfm_legacy_id: `wfm:contact:${norm(c.client_name)}|${contactName}`,
      client_id: clientId,
      name: contactName,
      role: blank(r['[Contact] Position']),
      email: blank(r['[Contact] Email']),
      phone: blank(r['[Contact] Mobile']) || blank(r['[Contact] Phone']),
      is_primary: false,
    });
  }
  const cUp = await upsertChunked('client_contacts', contactRows, 'wfm_legacy_id');
  console.log(`  ✓ upserted ${cUp} client_contacts`);

  // ── 6. Upsert projects ──────────────────────────────────────
  console.log('\n▶ upserting projects...');
  const projectRows = [];
  for (const j of targetJobs) {
    const r = j.raw;
    const jobNo = norm(j.job_no);
    const clientLegacy = `wfm:client:${norm(j.client_name)}`;
    const clientId = clientIdByLegacy.get(clientLegacy) || null;

    const wfmCategory = norm(r['[Category] Category']);
    const jobType = categoryMap.get(wfmCategory) || 'survey';

    const wfmStatus = norm(j.job_status);
    const status = statusMap.get(wfmStatus) || 'active';

    const created = parseWfmDate(r['[Job] Date Created']);
    const year = created ? new Date(created).getFullYear() : new Date().getFullYear();
    const sequence = parseInt(jobNo.replace(/\D/g, ''), 10) || 0;

    // Resolve job_manager_id from [Job] Job Manager via staff mapping
    const jobManagerName = norm(r['[Job] Job Manager']);
    const jobManagerId = jobManagerName ? (staffNameToProfileId.get(jobManagerName) || null) : null;

    projectRows.push({
      wfm_legacy_id: `wfm:job:${jobNo}`,
      job_number: jobNo,
      year,
      sequence,
      job_type: jobType,
      status,
      client_id: clientId,
      job_manager_id: jobManagerId,
      title: blank(r['[Job] Name']) || jobNo,
      description: blank(r['[Job] Description']),
      site_address: blank(r['[Job] Site Address']),
      lot_number: blank(r['[Job] Lot & DP']),
      purchase_order_number: blank(r['[Job] Client Order No.']),
      is_billable: true,
    });
  }
  const pUp = await upsertChunked('projects', projectRows, 'wfm_legacy_id');
  console.log(`  ✓ upserted ${pUp} projects`);

  const { data: dbProjects, error: dbpErr } = await sb.from('projects').select('id, wfm_legacy_id').not('wfm_legacy_id', 'is', null);
  if (dbpErr) throw dbpErr;
  const projectIdByLegacy = new Map(dbProjects.map((p) => [p.wfm_legacy_id, p.id]));

  // ── 7. Upsert time_entries ──────────────────────────────────
  console.log('\n▶ upserting time_entries...');
  function timeLegacyId(jobNo, staff, date, hours, note) {
    const h = crypto.createHash('sha1').update([jobNo, staff, date, hours, note].join('|')).digest('hex').slice(0, 16);
    return `wfm:time:${h}`;
  }

  const timeRows = [];
  let timeSkipped = 0;
  for (const t of timeRaw) {
    const jobNo = norm(t.job_no);
    if (!targetJobNos.has(jobNo)) { timeSkipped++; continue; }
    const r = t.raw;
    const hours = parseHours(r['[Time] Time']);
    if (!hours || hours <= 0) { timeSkipped++; continue; }
    const date = parseWfmDate(t.time_date);
    if (!date) { timeSkipped++; continue; }

    const projectLegacy = `wfm:job:${jobNo}`;
    const projectId = projectIdByLegacy.get(projectLegacy);
    if (!projectId) { timeSkipped++; continue; }

    const staffName = norm(t.staff_name);
    const staffId = staffNameToProfileId.get(staffName);
    if (!staffId) { timeSkipped++; continue; }

    const note = norm(r['[Time] Note']);
    const isBilled = /^yes\b/i.test(norm(r['[Time] Billed?']));
    const billable = norm(r['[Time] Billable']) === 'Yes';
    const rate = parseAmount(r['[Time] Billable Rate']) || 0;

    timeRows.push({
      wfm_legacy_id: timeLegacyId(jobNo, staffName, date, hours, note),
      project_id: projectId,
      staff_id: staffId,
      date,
      hours,
      description: note || null,
      is_billable: billable,
      rate_at_time: rate,
      // invoice_item_id linked in step 9
    });
  }
  console.log(`  selected ${timeRows.length} time entries (skipped ${timeSkipped})`);
  const tUp = await upsertChunked('time_entries', timeRows, 'wfm_legacy_id');
  console.log(`  ✓ upserted ${tUp} time_entries`);

  // ── 8. Upsert invoices ──────────────────────────────────────
  console.log('\n▶ upserting invoices...');
  const invoiceRows = [];
  let invSkipped = 0;
  for (const inv of invoicesRaw) {
    const r = inv.raw;
    const invNo = norm(inv.invoice_no);
    if (!invNo) { invSkipped++; continue; }
    const jobNumbers = norm(inv.job_numbers).split(',').map(norm).filter(Boolean);
    const matchingJobs = jobNumbers.filter((n) => targetJobNos.has(n));
    if (matchingJobs.length === 0) { invSkipped++; continue; }

    const projectId = projectIdByLegacy.get(`wfm:job:${matchingJobs[0]}`);
    if (!projectId) { invSkipped++; continue; }

    const subtotal = parseAmount(r['[Invoice] Amount']) || 0;
    const total = parseAmount(r['[Invoice] Amount (incl tax)']) || subtotal;
    const gst = total - subtotal;
    const paidYes = norm(r['[Invoice] Paid']) === 'Yes';
    const sentYes = norm(r['[Invoice] Sent']) === 'Yes';
    const status = paidYes ? 'paid' : (sentYes ? 'sent' : 'draft');

    invoiceRows.push({
      wfm_legacy_id: `wfm:invoice:${invNo}`,
      project_id: projectId,
      quote_id: null,
      invoice_number: invNo,
      status,
      subtotal,
      gst_amount: Math.round(gst * 100) / 100,
      total,
      due_date: parseWfmDate(r['[Invoice] Due Date']),
      sent_at: sentYes ? parseWfmDate(r['[Invoice] Date']) : null,
      paid_at: paidYes ? parseWfmDate(r['[Invoice] Date Paid']) : null,
      notes: matchingJobs.length > 1 ? `Multi-job WFM invoice: ${jobNumbers.join(', ')}` : null,
    });
  }
  console.log(`  selected ${invoiceRows.length} invoices (skipped ${invSkipped})`);
  const iUp = await upsertChunked('invoices', invoiceRows, 'wfm_legacy_id');
  console.log(`  ✓ upserted ${iUp} invoices`);

  const { data: dbInvoices, error: dbiErr } = await sb.from('invoices').select('id, wfm_legacy_id').not('wfm_legacy_id', 'is', null);
  if (dbiErr) throw dbiErr;
  const invoiceIdByLegacy = new Map(dbInvoices.map((i) => [i.wfm_legacy_id, i.id]));

  // ── 9. Upsert invoice_items ─────────────────────────────────
  console.log('\n▶ upserting invoice_items...');
  // Group invoiced_time rows by (invoice, task name+label)
  const importedInvoiceNos = new Set(invoiceRows.map((i) => i.invoice_number));
  const grouped = new Map(); // key = invoiceNo|taskNameLabel → { hours, amount, rateSample }
  for (const t of invTimeRaw) {
    const invNo = norm(t.invoice_no);
    if (!importedInvoiceNos.has(invNo)) continue;
    const taskLabel = norm(t.raw['[Invoice Task] Name + Label']) || norm(t.raw['[Invoice Task] Name']) || 'Time';
    const key = `${invNo}||${taskLabel}`;
    const hours = parseHours(t.raw['[Invoice Time] Invoiced Time']) || 0;
    const amount = parseAmount(t.raw['[Invoice Time] Invoiced Amount']) || 0;
    const rate = parseAmount(t.raw['[Invoice Time] Invoiced Rate']) || 0;
    if (!grouped.has(key)) grouped.set(key, { invNo, taskLabel, hours: 0, amount: 0, rateSample: rate });
    const g = grouped.get(key);
    g.hours += hours;
    g.amount += amount;
  }

  const itemRows = [];
  for (const g of grouped.values()) {
    const invoiceId = invoiceIdByLegacy.get(`wfm:invoice:${g.invNo}`);
    if (!invoiceId) continue;
    // Choose quantity/unit_price so quantity*unit_price ≈ amount.
    // Prefer hours as quantity when meaningful; fall back to qty=1.
    let quantity, unitPrice;
    if (g.hours > 0) {
      quantity = Math.round(g.hours * 100) / 100;
      unitPrice = Math.round((g.amount / g.hours) * 100) / 100;
    } else {
      quantity = 1;
      unitPrice = Math.round(g.amount * 100) / 100;
    }
    itemRows.push({
      wfm_legacy_id: `wfm:invoice_item:${g.invNo}|${g.taskLabel}`,
      invoice_id: invoiceId,
      description: g.taskLabel,
      quantity,
      unit_price: unitPrice,
      sort_order: 0,
    });
  }

  // Synthetic line items for fixed-fee + cost gaps
  const tasksInvoicedByInv = new Map();
  const costsInvoicedByInv = new Map();
  for (const inv of invoicesRaw) {
    const invNo = norm(inv.invoice_no);
    if (!importedInvoiceNos.has(invNo)) continue;
    tasksInvoicedByInv.set(invNo, parseAmount(inv.raw['[Invoice] Tasks Invoiced']) || 0);
    costsInvoicedByInv.set(invNo, parseAmount(inv.raw['[Invoice] Costs Invoiced']) || 0);
  }
  const timeAmountByInv = new Map();
  for (const g of grouped.values()) {
    timeAmountByInv.set(g.invNo, (timeAmountByInv.get(g.invNo) || 0) + g.amount);
  }
  let syntheticFee = 0, syntheticCost = 0;
  for (const invNo of importedInvoiceNos) {
    const tasks = tasksInvoicedByInv.get(invNo) || 0;
    const time = timeAmountByInv.get(invNo) || 0;
    const costs = costsInvoicedByInv.get(invNo) || 0;
    const invoiceId = invoiceIdByLegacy.get(`wfm:invoice:${invNo}`);
    if (!invoiceId) continue;

    const feeGap = tasks - time;
    if (feeGap > 0.5) {
      itemRows.push({
        wfm_legacy_id: `wfm:invoice_item:${invNo}|__fee_gap__`,
        invoice_id: invoiceId,
        description: 'Fee (non-time)',
        quantity: 1,
        unit_price: Math.round(feeGap * 100) / 100,
        sort_order: 100,
      });
      syntheticFee++;
    }
    if (costs > 0.5) {
      itemRows.push({
        wfm_legacy_id: `wfm:invoice_item:${invNo}|__costs__`,
        invoice_id: invoiceId,
        description: 'Disbursements',
        quantity: 1,
        unit_price: Math.round(costs * 100) / 100,
        sort_order: 200,
      });
      syntheticCost++;
    }
  }
  console.log(`  ${grouped.size} time-based items + ${syntheticFee} fee + ${syntheticCost} cost = ${itemRows.length} total`);
  const iiUp = await upsertChunked('invoice_items', itemRows, 'wfm_legacy_id');
  console.log(`  ✓ upserted ${iiUp} invoice_items`);

  // ── 10. Link time_entries.invoice_item_id ───────────────────
  console.log('\n▶ linking time_entries → invoice_items...');
  const { data: dbItems, error: dbItemsErr } = await sb.from('invoice_items').select('id, wfm_legacy_id').not('wfm_legacy_id', 'is', null);
  if (dbItemsErr) throw dbItemsErr;
  const itemIdByLegacy = new Map(dbItems.map((i) => [i.wfm_legacy_id, i.id]));

  let linked = 0, linkedRelaxed = 0, linkSkip = 0;

  // Build lookup from time_entry legacy_id → invoice_item legacy_id via invoiced_time rows
  // For each invoiced_time row, compute the time legacy_id and find the matching invoice_item
  // (one item per invoice + task group).
  const updates = [];
  for (const t of invTimeRaw) {
    const invNo = norm(t.invoice_no);
    if (!importedInvoiceNos.has(invNo)) continue;
    const jobNo = norm(t.job_no);
    if (!targetJobNos.has(jobNo)) continue;
    const staffName = norm(t.staff_name);
    const date = parseWfmDate(t.time_date);
    if (!date) { linkSkip++; continue; }
    const hours = parseHours(t.raw['[Invoice Time] Time']);
    if (!hours || hours <= 0) { linkSkip++; continue; }
    const note = norm(t.raw['[Invoice Time] Note']);
    const taskLabel = norm(t.raw['[Invoice Task] Name + Label']) || norm(t.raw['[Invoice Task] Name']) || 'Time';
    const itemId = itemIdByLegacy.get(`wfm:invoice_item:${invNo}|${taskLabel}`);
    if (!itemId) { linkSkip++; continue; }
    const legacy = timeLegacyId(jobNo, staffName, date, hours, note);
    updates.push({ legacy, itemId });
  }

  // Apply updates in chunks (Supabase needs us to update one by one or
  // batch via .in() filter — use small batches grouped by item_id).
  if (!dryRun) {
    // Group by item_id to batch updates
    const byItem = new Map();
    for (const u of updates) {
      if (!byItem.has(u.itemId)) byItem.set(u.itemId, []);
      byItem.get(u.itemId).push(u.legacy);
    }
    for (const [itemId, legacies] of byItem) {
      const CHUNK = 200;
      for (let i = 0; i < legacies.length; i += CHUNK) {
        const slice = legacies.slice(i, i + CHUNK);
        const { count, error } = await sb.from('time_entries')
          .update({ invoice_item_id: itemId }, { count: 'exact' })
          .in('wfm_legacy_id', slice);
        if (error) throw new Error(`link time→item: ${error.message}`);
        linked += count || 0;
      }
    }
  } else {
    linked = updates.length;
  }
  console.log(`  ✓ linked ${linked} time_entries to invoice_items   (skipped ${linkSkip})`);

  // ── Done ────────────────────────────────────────────────────
  await logEvent(batchId, 'summary', 'ok', dryRun ? 'dry run' : 'transform complete', null, {
    clients: upserted, contacts: cUp, projects: pUp, time_entries: tUp,
    invoices: iUp, invoice_items: iiUp, time_to_item_links: linked,
  });

  console.log('\n─────────────────────────────────────────────');
  console.log(`  ${upserted.toString().padStart(6)} clients`);
  console.log(`  ${cUp.toString().padStart(6)} client_contacts`);
  console.log(`  ${pUp.toString().padStart(6)} projects`);
  console.log(`  ${tUp.toString().padStart(6)} time_entries`);
  console.log(`  ${iUp.toString().padStart(6)} invoices`);
  console.log(`  ${iiUp.toString().padStart(6)} invoice_items`);
  console.log(`  ${linked.toString().padStart(6)} time→item links`);
  console.log('─────────────────────────────────────────────');
  console.log(dryRun ? '  DRY RUN — no changes written.' : '  ✓ transform complete');
}

main().catch((err) => {
  console.error('\n✗ unhandled error:', err);
  process.exit(1);
});
