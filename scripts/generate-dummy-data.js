#!/usr/bin/env node
/**
 * Regenerates the "derived" sections of reference/dlcs-dummy-data.json:
 *   task_definitions, projects (J2026 internal only), project_tasks,
 *   task_assignments, task_items, task_item_assignments,
 *   time_entries, quotes, quote_items, invoices, invoice_items.
 *
 * Keeps the existing clients + client projects untouched (by id).
 * Uses the real staff UUIDs from the live DB.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'reference', 'dlcs-dummy-data.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// ── Deterministic PRNG ──────────────────────────────────────────
let seed = 42;
const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const pick = (a) => a[Math.floor(rand() * a.length)];
const pickN = (a, n) => {
  const c = [...a]; const r = [];
  while (r.length < n && c.length) r.push(c.splice(Math.floor(rand() * c.length), 1)[0]);
  return r;
};
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const chance = (p) => rand() < p;

// ── UUID helper (deterministic per-prefix counters) ─────────────
const h = (n, len) => n.toString(16).padStart(len, '0');
const counters = {};
const uid = (p) => {
  counters[p] = (counters[p] || 0) + 1;
  const n = counters[p];
  return `${p}${h(n, 7)}-${h(n, 4)}-4${h(n, 3)}-8${h(n, 3)}-${h(n, 12)}`;
};

// ── Constants ───────────────────────────────────────────────────
const NOW = '2026-04-18T00:00:00+00:00';
const TODAY = new Date('2026-04-18T00:00:00Z');
const addDays = (d, n) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const isWeekday = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return d >= 1 && d <= 5;
};

// ── Staff (real UUIDs from live DB) ─────────────────────────────
const STAFF = [
  { id: '43a61e97-6521-40f1-898f-2468e2218034', name: 'Rebecca McLachlan', role: 'administration', rate: 0 },
  { id: '47d45cde-92b8-4614-85de-a461f2842f4c', name: 'Justin Dunlop', role: 'drafting', rate: 150 },
  { id: 'cfa57392-f9e5-44d6-816a-e9f2a11be290', name: 'Conrad Adams', role: 'field_assistant', rate: 110 },
  { id: '993b6f44-0508-45af-8ce0-a9817fb27ef9', name: 'Ben Stone', role: 'field_surveyor', rate: 140 },
  { id: '24c3d978-7056-4252-8b06-bf4476198526', name: 'Doug Louth', role: 'field_surveyor', rate: 140 },
  { id: '028cae93-e8cb-4f98-b2f1-958d42c497d2', name: 'Robert Tisdell', role: 'field_surveyor', rate: 140 },
  { id: '7a0b1c98-071d-4542-82fd-4dd2574518bc', name: 'Stephen Felton', role: 'field_surveyor', rate: 140 },
  { id: 'b347d95c-e866-4ef7-ae05-cf9458079ce9', name: 'Teina Harawira', role: 'field_surveyor', rate: 140 },
  { id: '24449d79-1839-488c-88dd-6e791cf01c06', name: 'Tom Braund', role: 'field_surveyor', rate: 140 },
  { id: '3e133a34-416e-4801-be06-fc0eb0c0ccf4', name: 'Dean Blakemore', role: 'office_surveyor', rate: 160 },
  { id: '163e3dac-bb1e-40c9-a25c-9cce4571f26b', name: 'Laclan Manning', role: 'office_surveyor', rate: 160 },
  { id: '1411dc1a-301e-49a1-a6ec-1a70255e4484', name: 'Liam Marshall', role: 'office_surveyor', rate: 160 },
  { id: '741e778e-85f2-4331-9f32-16ad6eff29df', name: 'Alex Lascelles', role: 'registered_surveyor', rate: 220 },
  { id: 'fecbfa59-6262-4988-bafd-6f2f76176d61', name: 'Mitchell Warwick', role: 'registered_surveyor', rate: 220 },
  { id: 'e71eb6e7-72a8-44af-82af-8d7bdc706a45', name: 'Nigel Delfs', role: 'registered_surveyor', rate: 220 },
  { id: '6252146b-6603-46cd-95a8-8594632cbfb2', name: 'Phillip Marriott', role: 'registered_surveyor', rate: 220 },
  { id: '1d9a3add-cedd-4c46-8618-1ea3b73925e6', name: 'Thomas Campbell', role: 'registered_surveyor', rate: 220 },
  { id: '28b3c93c-01ff-4ed9-b4f5-5d624a7dc446', name: 'Tim Rheinberger', role: 'registered_surveyor', rate: 220 },
];
const byRole = (r) => STAFF.filter(s => s.role === r);
const RS = byRole('registered_surveyor');
const OS = byRole('office_surveyor');
const FS = byRole('field_surveyor');
const FA = byRole('field_assistant');
const DR = byRole('drafting');

// ── Task definitions ────────────────────────────────────────────
const TASK_DEFS = [
  { key: 'final_dp',       name: 'Final DP',                 job_type: 'survey' },
  { key: 'draft_dp',       name: 'Draft DP',                 job_type: 'survey' },
  { key: 'strata_plan',    name: 'Strata Plan',              job_type: 'survey' },
  { key: 'id_survey',      name: 'Identification Survey',    job_type: 'survey' },
  { key: 'contour_detail', name: 'Contour & Detail Survey',  job_type: null },
  { key: 'redline',        name: 'Redline Survey',           job_type: 'sewer_water' },
  { key: 'wae',            name: 'Work as Executed',         job_type: 'sewer_water' },
  { key: 'setout',         name: 'Set-out Survey',           job_type: null },
  { key: 'consulting',     name: 'Consulting',               job_type: null },
];
const tdId = {};
const task_definitions = TASK_DEFS.map((t, i) => {
  const id = uid('d');
  tdId[t.key] = id;
  return {
    id, name: t.name, applicable_job_type: t.job_type,
    is_active: true, sort_order: (i + 1) * 10,
    created_at: NOW,
  };
});

// ── J2026 internal project ──────────────────────────────────────
// Hard-coded UUID (outside the b0000001..b0000020 range used by client projects)
const j2026Id = 'b0009999-9999-4999-8999-999999999999';
const j2026 = {
  id: j2026Id,
  job_number: 'J2026',
  year: 2026,
  sequence: 9999,
  status: 'active',
  client_id: null,
  title: 'J2026 - Internal / Admin',
  description: 'Internal overhead time for office staff (admin, training, marketing, QA).',
  site_address: null,
  suburb: null,
  lot_number: null,
  plan_number: null,
  local_authority: null,
  purchase_order_number: null,
  is_billable: false,
  created_by: null,
  created_at: NOW,
  updated_at: NOW,
  job_type: 'internal',
  job_manager_id: null,
};

// Drop any previously-generated J2026 before re-adding
data.projects = data.projects.filter(p => p.job_number !== 'J2026');
data.projects.push(j2026);

// Assign a registered surveyor as job manager to every client project
const clientProjects = data.projects.filter(p => p.id !== j2026Id);
clientProjects.forEach((p, i) => { p.job_manager_id = RS[i % RS.length].id; });

// ── Working buffers ─────────────────────────────────────────────
const project_tasks = [];
const task_assignments = [];
const task_items = [];
const task_item_assignments = [];
const time_entries = [];
const quotes = [];
const quote_items = [];
const invoices = [];
const invoice_items = [];

// ── Task generation helpers ─────────────────────────────────────
function pickTasksFor(project) {
  const isSW = project.job_type === 'sewer_water';
  const svyPool = ['id_survey', 'contour_detail', 'setout', 'draft_dp', 'final_dp', 'strata_plan'];
  const swPool  = ['contour_detail', 'redline', 'wae', 'setout'];
  const pool = isSW ? swPool : svyPool;
  const n = between(2, 4);
  const keys = pickN(pool, Math.min(n, pool.length));
  if (chance(0.7)) keys.push('consulting'); // RS-only task
  return keys;
}

function feeFor(key) {
  const ranges = {
    id_survey:      [2500, 4500],
    contour_detail: [3000, 6500],
    setout:         [1500, 3500],
    draft_dp:       [2000, 4000],
    final_dp:       [3500, 7500],
    strata_plan:    [4500, 9500],
    redline:        [2800, 5500],
    wae:            [2200, 4800],
    consulting:     [800, 2500],
  };
  const r = ranges[key] || [1000, 3000];
  return between(Math.round(r[0] / 100), Math.round(r[1] / 100)) * 100;
}

const ITEM_TITLES = {
  id_survey:      ['Field pickup', 'Boundary reinstatement', 'Plan drafting', 'RS check & sign-off'],
  contour_detail: ['Site pickup', 'Office calcs', 'DWG production', 'Client delivery'],
  setout:         ['Peg preparation', 'On-site set-out', 'As-marked plan'],
  draft_dp:       ['Field pickup', 'Draft plan prep', 'Internal review', 'Council lodge'],
  final_dp:       ['Plan finalisation', 'Council RFI response', 'DP registration', 'Post-reg closeout'],
  strata_plan:    ['Building pickup', 'Strata schedule', 'Plan drafting', 'Council lodge'],
  redline:        ['Site capture', 'Sewer redline plan', 'Authority submission'],
  wae:            ['As-built capture', 'WAE plan drafting', 'Certification'],
  consulting:     ['Phone consult', 'Site meeting', 'Advice email'],
};
const itemTitle = (key, i) => ITEM_TITLES[key]?.[i] ?? `Item ${i + 1}`;

// ── Generate per client project ─────────────────────────────────
for (const p of clientProjects) {
  if (p.status === 'on_hold') continue; // skip on-hold jobs for time/items

  const taskKeys = pickTasksFor(p);
  const projectCreated = new Date('2026-02-15T00:00:00Z');

  for (let ti = 0; ti < taskKeys.length; ti++) {
    const key = taskKeys[ti];
    const td = TASK_DEFS.find(t => t.key === key);
    const taskId = uid('c');
    const isConsult = key === 'consulting';
    const isDraftTask = ['draft_dp', 'final_dp', 'strata_plan'].includes(key);
    const isFieldTask = ['id_survey', 'contour_detail', 'setout', 'redline', 'wae'].includes(key);
    const feeType = chance(0.5) ? 'fixed' : 'hourly';
    const quoted = feeType === 'fixed' ? feeFor(key) : null;
    const status = p.status === 'completed'
      ? 'completed'
      : pick(['not_started', 'in_progress', 'in_progress', 'in_progress', 'completed']);

    project_tasks.push({
      id: taskId,
      project_id: p.id,
      task_definition_id: tdId[key],
      title: td.name,
      description: null,
      status,
      fee_type: feeType,
      quoted_amount: quoted,
      claimed_amount: 0,
      due_date: addDays(TODAY, between(-10, 40)),
      sort_order: (ti + 1) * 10,
      created_by: p.job_manager_id,
      created_at: NOW,
      updated_at: NOW,
    });

    // ── Task assignments ──
    const rs = pick(RS); // every task has one registered surveyor
    const assigned = new Set();
    const assignList = []; // keep order for easier time-entry generation
    const addAssign = (staff, hrs) => {
      if (assigned.has(staff.id)) return;
      assigned.add(staff.id);
      assignList.push(staff);
      task_assignments.push({
        id: uid('e'),
        task_id: taskId,
        staff_id: staff.id,
        estimated_hours: hrs,
        created_at: NOW,
      });
    };

    addAssign(rs, isConsult ? between(2, 8) : between(3, 12));

    if (!isConsult) {
      if (isFieldTask) {
        pickN(FS, between(1, 2)).forEach(s => addAssign(s, between(4, 14)));
        if (chance(0.5)) addAssign(FA[0], between(3, 10));
        if (chance(0.4)) addAssign(pick(OS), between(2, 6));
      }
      if (isDraftTask) {
        addAssign(DR[0], between(8, 20));
        if (chance(0.6)) addAssign(pick(OS), between(3, 8));
      }
      if (!isFieldTask && !isDraftTask) {
        // contour_detail handled as field; fallback: pull in office surveyor
        addAssign(pick(OS), between(2, 6));
      }
    }

    // ── Task items (my-work board) ──
    const itemCount = between(2, 4);
    for (let ii = 0; ii < itemCount; ii++) {
      const itemId = uid('f');
      const itemStatus = status === 'completed'
        ? 'completed'
        : pick(['not_started', 'in_progress', 'completed', 'in_progress']);
      task_items.push({
        id: itemId,
        task_id: taskId,
        title: itemTitle(key, ii),
        description: null,
        status: itemStatus,
        due_date: addDays(TODAY, between(-5, 30)),
        sort_order: (ii + 1) * 10,
        created_by: p.job_manager_id,
        created_at: NOW,
        updated_at: NOW,
      });
      const iaCount = Math.min(between(1, 2), assignList.length);
      pickN(assignList, iaCount).forEach(s => {
        task_item_assignments.push({
          id: uid('a'),
          item_id: itemId,
          staff_id: s.id,
          created_at: NOW,
        });
      });
    }

    // ── Time entries ──
    for (const s of assignList) {
      if (s.role === 'administration') continue;
      const entryCount = between(2, 6);
      for (let k = 0; k < entryCount; k++) {
        let dayOffset = -between(0, 35); // last ~7 weeks
        let d = addDays(TODAY, dayOffset);
        let guard = 10;
        while (!isWeekday(d) && guard-- > 0) { dayOffset -= 1; d = addDays(TODAY, dayOffset); }
        const hours = +(between(2, 16) * 0.5).toFixed(1); // 1.0 – 8.0
        time_entries.push({
          id: uid('9'),
          project_id: p.id,
          task_id: taskId,
          staff_id: s.id,
          date: d,
          hours,
          description: null,
          is_billable: true,
          rate_at_time: s.rate,
          invoice_item_id: null,
          created_at: NOW,
          updated_at: NOW,
        });
      }
    }
  }
}

// ── J2026 internal tasks + overhead entries for RS + OS ─────────
const INTERNAL_TITLES = [
  'General Office Admin',
  'Training & CPD',
  'Marketing & BD',
  'QA / Internal Review',
  'Tool & Instrument Calibration',
];
const internalTaskIds = [];
INTERNAL_TITLES.forEach((title, i) => {
  const tid = uid('c');
  internalTaskIds.push(tid);
  project_tasks.push({
    id: tid,
    project_id: j2026Id,
    task_definition_id: null,
    title,
    description: null,
    status: 'in_progress',
    fee_type: 'non_billable',
    quoted_amount: null,
    claimed_amount: 0,
    due_date: null,
    sort_order: (i + 1) * 10,
    created_by: null,
    created_at: NOW,
    updated_at: NOW,
  });
  // assign all RS + OS
  for (const s of [...RS, ...OS]) {
    task_assignments.push({
      id: uid('e'),
      task_id: tid,
      staff_id: s.id,
      estimated_hours: null,
      created_at: NOW,
    });
  }
});

// Overhead time entries — ~1 per week per RS/OS, on a random internal task
for (const s of [...RS, ...OS]) {
  for (let w = 0; w < 7; w++) {
    if (!chance(0.75)) continue;
    let d = addDays(TODAY, -(w * 7 + between(0, 4)));
    let guard = 7;
    while (!isWeekday(d) && guard-- > 0) d = addDays(d, -1);
    time_entries.push({
      id: uid('9'),
      project_id: j2026Id,
      task_id: pick(internalTaskIds),
      staff_id: s.id,
      date: d,
      hours: +(between(1, 6) * 0.5).toFixed(1), // 0.5 – 3.0
      description: null,
      is_billable: false,
      rate_at_time: s.rate,
      invoice_item_id: null,
      created_at: NOW,
      updated_at: NOW,
    });
  }
}

// ── Quotes (~60% of client projects) ────────────────────────────
let quoteSeq = 100;
for (const p of clientProjects) {
  if (!chance(0.6)) continue;
  const pTasks = project_tasks.filter(t => t.project_id === p.id);
  if (!pTasks.length) continue;
  const qid = uid('7');
  let subtotal = 0;
  const qitems = pTasks.map((t, i) => {
    const up = t.quoted_amount ?? between(20, 60) * 100;
    subtotal += up;
    return {
      id: uid('8'),
      quote_id: qid,
      task_id: t.id,
      description: t.title,
      quantity: 1,
      unit_price: up,
      amount: up,
      sort_order: (i + 1) * 10,
      created_at: NOW,
    };
  });
  const gst = Math.round(subtotal * 0.1 * 100) / 100;
  const total = subtotal + gst;
  const status = pick(['issued', 'accepted', 'accepted', 'accepted', 'declined']);
  quotes.push({
    id: qid,
    project_id: p.id,
    quote_number: `Q2026-${++quoteSeq}`,
    status,
    subtotal,
    gst_amount: gst,
    total,
    notes: null,
    valid_until: addDays(TODAY, 30),
    sent_at: addDays(TODAY, -between(10, 60)),
    approved_at: status === 'accepted' ? addDays(TODAY, -between(5, 40)) : null,
    created_by: p.job_manager_id,
    created_at: NOW,
    updated_at: NOW,
    client_id: p.client_id,
    contact_name: null,
    contact_phone: null,
    contact_email: null,
    site_address: p.site_address,
    suburb: p.suburb,
    lot_number: p.lot_number,
    plan_number: p.plan_number,
    job_type: p.job_type,
    template_key: null,
    selected_scope_items: null,
    selected_note_items: null,
  });
  quote_items.push(...qitems);
}

// ── Invoices (~40% of client projects) ──────────────────────────
let invSeq = 200;
for (const p of clientProjects) {
  const projQuote = quotes.find(q => q.project_id === p.id && q.status === 'accepted');
  const willInvoice = projQuote ? chance(0.75) : chance(0.15);
  if (!willInvoice) continue;
  const pTasks = project_tasks.filter(t => t.project_id === p.id);
  if (!pTasks.length) continue;

  const invId = uid('6');
  const invTasks = pickN(pTasks, between(1, Math.min(3, pTasks.length)));
  let subtotal = 0;
  const iitems = invTasks.map((t, i) => {
    let up;
    if (t.fee_type === 'fixed') {
      const pct = chance(0.5) ? 1 : 0.5;
      up = Math.round((t.quoted_amount || 3000) * pct);
      t.claimed_amount = up;
    } else {
      const hrs = time_entries
        .filter(te => te.task_id === t.id)
        .reduce((a, e) => a + e.hours, 0);
      up = Math.round(hrs * 180);
      if (up < 500) up = between(8, 25) * 100;
    }
    subtotal += up;
    return {
      id: uid('5'),
      invoice_id: invId,
      description: t.title,
      quantity: 1,
      unit_price: up,
      amount: up,
      time_entry_id: null,
      task_id: t.id,
      prev_claimed_amount: 0,
      sort_order: (i + 1) * 10,
      created_at: NOW,
    };
  });
  const gst = Math.round(subtotal * 0.1 * 100) / 100;
  const total = subtotal + gst;
  const status = pick(['sent', 'paid', 'paid', 'overdue', 'draft']);
  invoices.push({
    id: invId,
    project_id: p.id,
    quote_id: projQuote?.id ?? null,
    invoice_number: `INV-${++invSeq}`,
    status,
    subtotal,
    gst_amount: gst,
    total,
    notes: null,
    due_date: addDays(TODAY, status === 'paid' ? -between(5, 30) : between(-5, 30)),
    sent_at: addDays(TODAY, -between(5, 40)),
    paid_at: status === 'paid' ? addDays(TODAY, -between(1, 20)) : null,
    created_by: p.job_manager_id,
    created_at: NOW,
    updated_at: NOW,
  });
  invoice_items.push(...iitems);
}

// ── Write ───────────────────────────────────────────────────────
data.task_definitions      = task_definitions;
data.project_tasks         = project_tasks;
data.task_assignments      = task_assignments;
data.task_items            = task_items;
data.task_item_assignments = task_item_assignments;
data.time_entries          = time_entries;
data.quotes                = quotes;
data.quote_items           = quote_items;
data.invoices              = invoices;
data.invoice_items         = invoice_items;
data.exported_at           = new Date().toISOString();
data.version               = 3;

fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');

const stats = {
  task_definitions:      task_definitions.length,
  project_tasks:         project_tasks.length,
  task_assignments:      task_assignments.length,
  task_items:            task_items.length,
  task_item_assignments: task_item_assignments.length,
  time_entries:          time_entries.length,
  quotes:                quotes.length,
  quote_items:           quote_items.length,
  invoices:              invoices.length,
  invoice_items:         invoice_items.length,
};
console.log('Wrote', FILE);
console.table(stats);
