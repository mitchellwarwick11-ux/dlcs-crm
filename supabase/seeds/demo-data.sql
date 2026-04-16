-- ============================================================
-- DLCS CRM — Demo Seed Data
-- ============================================================
-- Paste this entire script into the Supabase SQL Editor and run it.
-- All records are tagged with '[demo-seed]' and can be removed
-- via the "Clear Demo Data" button in Settings.
-- ============================================================

DO $$
DECLARE
  -- Client IDs
  c1  UUID; c2  UUID; c3  UUID; c4  UUID; c5  UUID;
  c6  UUID; c7  UUID; c8  UUID; c9  UUID; c10 UUID;
  c11 UUID; c12 UUID; c13 UUID; c14 UUID; c15 UUID;
  c16 UUID; c17 UUID; c18 UUID; c19 UUID; c20 UUID;
  c21 UUID; c22 UUID; c23 UUID; c24 UUID; c25 UUID;

  -- Project IDs
  p1  UUID; p2  UUID; p3  UUID; p4  UUID; p5  UUID;
  p6  UUID; p7  UUID; p8  UUID; p9  UUID; p10 UUID;
  p11 UUID; p12 UUID; p13 UUID; p14 UUID; p15 UUID;
  p16 UUID; p17 UUID; p18 UUID;

  -- Quote IDs
  q1  UUID; q2  UUID; q3  UUID; q4  UUID; q5  UUID;
  q6  UUID; q7  UUID; q8  UUID; q9  UUID; q10 UUID;
  q11 UUID; q12 UUID; q13 UUID; q14 UUID; q15 UUID;
  q16 UUID; q17 UUID; q18 UUID; q19 UUID; q20 UUID;
  q21 UUID; q22 UUID;

  has_staff BOOLEAN;

BEGIN

  -- ============================================================
  -- 1. CLIENTS
  -- ============================================================

  -- Companies
  INSERT INTO clients (name, company_name, email, phone, suburb, state, is_active, notes)
  VALUES ('James Henderson', 'Henderson Property Group', 'james@hendersonpg.com.au', '0411 234 567', 'Newstead', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c1;

  INSERT INTO clients (name, company_name, email, phone, suburb, state, is_active, notes)
  VALUES ('Rebecca Walsh', 'Coastal Development Co', 'rebecca@coastaldev.com.au', '0422 345 678', 'Coolangatta', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c2;

  INSERT INTO clients (name, company_name, email, phone, suburb, state, is_active, notes)
  VALUES ('David Chen', 'Pinnacle Homes', 'david.chen@pinnaclehomes.com.au', '0433 456 789', 'Springfield', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c3;

  INSERT INTO clients (name, company_name, email, phone, suburb, state, is_active, notes)
  VALUES ('Karen O''Brien', 'Meridian Builders', 'karen@meridianbuilders.com.au', '0444 567 890', 'Toowoomba', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c4;

  INSERT INTO clients (name, company_name, email, phone, suburb, state, is_active, notes)
  VALUES ('Michael Torres', 'Summit Developments', 'm.torres@summitdev.com.au', '0455 678 901', 'Hamilton', 'NSW', true, '[demo-seed]')
  RETURNING id INTO c5;

  INSERT INTO clients (name, company_name, email, phone, suburb, state, is_active, notes)
  VALUES ('Susan Park', 'Riverfront Realty', 'susan@riverfrontrealty.com.au', '0466 789 012', 'Fortitude Valley', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c6;

  INSERT INTO clients (name, company_name, email, phone, suburb, state, is_active, notes)
  VALUES ('Tom Murray', 'Blueprint Architects', 'tom.murray@blueprintarch.com.au', '0477 890 123', 'South Brisbane', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c7;

  INSERT INTO clients (name, company_name, email, phone, suburb, state, is_active, notes)
  VALUES ('Emma Richardson', 'Skyline Property', 'emma@skylineproperty.com.au', '0488 901 234', 'Chermside', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c8;

  INSERT INTO clients (name, company_name, email, phone, suburb, state, is_active, notes)
  VALUES ('Greg Lawson', 'Pacific Constructions', 'greg.lawson@pacificconstruct.com.au', '0411 012 345', 'Coorparoo', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c9;

  INSERT INTO clients (name, company_name, email, phone, suburb, state, is_active, notes)
  VALUES ('Natalie Foster', 'Horizon Land Group', 'natalie@horizonlandgroup.com.au', '0422 123 456', 'Milton', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c10;

  -- Individuals
  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Robert Sinclair', 'robert.sinclair@gmail.com', '0433 234 567', 'Paddington', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c11;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Catherine Blake', 'cblake@hotmail.com', '0444 345 678', 'Ascot', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c12;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Paul Nguyen', 'paul.nguyen@outlook.com', '0455 456 789', 'Sunnybank', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c13;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Margaret Wilson', 'mwilson@bigpond.com', '0466 567 890', 'Graceville', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c14;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Steven Abbott', 's.abbott@gmail.com', '0477 678 901', 'Kenmore', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c15;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Lisa Chang', 'lisa.chang@icloud.com', '0488 789 012', 'Taringa', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c16;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Andrew McPherson', 'a.mcpherson@gmail.com', '0411 890 123', 'Yeronga', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c17;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Jennifer Walsh', 'jen.walsh@hotmail.com', '0422 901 234', 'Holland Park', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c18;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Chris Thornton', 'cthornton@gmail.com', '0433 012 345', 'Moorooka', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c19;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Rachel Kim', 'rachel.kim@gmail.com', '0444 123 456', 'Toowong', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c20;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Daniel Russo', 'd.russo@icloud.com', '0455 234 567', 'West End', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c21;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Sandra O''Connor', 'soconnor@bigpond.com', '0466 345 678', 'Indooroopilly', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c22;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Michael Patel', 'michael.patel@gmail.com', '0477 456 789', 'Carindale', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c23;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Amanda Stewart', 'amanda.stewart@outlook.com', '0488 567 890', 'Mansfield', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c24;

  INSERT INTO clients (name, email, phone, suburb, state, is_active, notes)
  VALUES ('Thomas Walsh', 't.walsh@gmail.com', '0411 678 901', 'Rochedale', 'QLD', true, '[demo-seed]')
  RETURNING id INTO c25;

  -- ============================================================
  -- 2. PROJECTS  (job numbers 25901–25918, year 2025)
  -- ============================================================

  -- Active (10)
  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25901', 2025, 901, 'survey', 'active', c1, '25901 - Newstead', '14 James St', 'Newstead', true, '[demo-seed]')
  RETURNING id INTO p1;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25902', 2025, 902, 'survey', 'active', c2, '25902 - Coolangatta', '8 Marine Pde', 'Coolangatta', true, '[demo-seed]')
  RETURNING id INTO p2;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25903', 2025, 903, 'survey', 'active', c3, '25903 - Springfield', '42 Pinnacle Dr', 'Springfield', true, '[demo-seed]')
  RETURNING id INTO p3;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25904', 2025, 904, 'survey', 'active', c4, '25904 - Toowoomba', '77 Russell St', 'Toowoomba', true, '[demo-seed]')
  RETURNING id INTO p4;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25905', 2025, 905, 'survey', 'active', c7, '25905 - South Brisbane', '3 Tribune St', 'South Brisbane', true, '[demo-seed]')
  RETURNING id INTO p5;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25906', 2025, 906, 'survey', 'active', c8, '25906 - Chermside', '19 Gympie Rd', 'Chermside', true, '[demo-seed]')
  RETURNING id INTO p6;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25907', 2025, 907, 'survey', 'active', c11, '25907 - Paddington', '55 Latrobe Tce', 'Paddington', true, '[demo-seed]')
  RETURNING id INTO p7;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25908', 2025, 908, 'survey', 'active', c12, '25908 - Ascot', '11 Lancaster Rd', 'Ascot', true, '[demo-seed]')
  RETURNING id INTO p8;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25909', 2025, 909, 'survey', 'active', c13, '25909 - Sunnybank', '28 Mains Rd', 'Sunnybank', true, '[demo-seed]')
  RETURNING id INTO p9;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25910', 2025, 910, 'sewer_water', 'active', c9, '25910 - Coorparoo', '6 Old Cleveland Rd', 'Coorparoo', true, '[demo-seed]')
  RETURNING id INTO p10;

  -- On Hold (4)
  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25911', 2025, 911, 'survey', 'on_hold', c5, '25911 - Hamilton', '34 Bent St', 'Hamilton', true, '[demo-seed]')
  RETURNING id INTO p11;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25912', 2025, 912, 'survey', 'on_hold', c14, '25912 - Graceville', '9 Honour Ave', 'Graceville', true, '[demo-seed]')
  RETURNING id INTO p12;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25913', 2025, 913, 'survey', 'on_hold', c15, '25913 - Kenmore', '63 Moggill Rd', 'Kenmore', true, '[demo-seed]')
  RETURNING id INTO p13;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25914', 2025, 914, 'survey', 'on_hold', c16, '25914 - Taringa', '5 Swann Rd', 'Taringa', true, '[demo-seed]')
  RETURNING id INTO p14;

  -- Completed (4)
  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25915', 2025, 915, 'survey', 'completed', c6, '25915 - Fortitude Valley', '22 Warner St', 'Fortitude Valley', true, '[demo-seed]')
  RETURNING id INTO p15;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25916', 2025, 916, 'survey', 'completed', c17, '25916 - Yeronga', '41 Fairfield Rd', 'Yeronga', true, '[demo-seed]')
  RETURNING id INTO p16;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25917', 2025, 917, 'survey', 'completed', c18, '25917 - Holland Park', '18 Nursery Rd', 'Holland Park', true, '[demo-seed]')
  RETURNING id INTO p17;

  INSERT INTO projects (job_number, year, sequence, job_type, status, client_id, title, site_address, suburb, is_billable, description)
  VALUES ('25918', 2025, 918, 'sewer_water', 'completed', c10, '25918 - Milton', '100 Sylvan Rd', 'Milton', true, '[demo-seed]')
  RETURNING id INTO p18;

  -- ============================================================
  -- 3. TASKS
  -- ============================================================

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p1, 'Contour & Detail Survey', 'fixed', 4800, 'in_progress', 0),
    (p1, 'DBYD Research', 'fixed', 280, 'completed', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p2, 'Feature Survey', 'fixed', 5200, 'not_started', 0),
    (p2, 'Draft Plan', 'fixed', 650, 'not_started', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p3, 'Identification Survey', 'fixed', 2800, 'in_progress', 0),
    (p3, 'Boundary Survey', 'fixed', 3200, 'not_started', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p4, 'Contour & Detail Survey', 'fixed', 6500, 'not_started', 0),
    (p4, 'DBYD Research', 'fixed', 280, 'not_started', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p5, 'Boundary Survey', 'fixed', 4100, 'in_progress', 0),
    (p5, 'Feature Survey', 'fixed', 3800, 'not_started', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p6, 'Identification Survey', 'fixed', 2400, 'not_started', 0);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p7, 'Contour & Detail Survey', 'fixed', 3900, 'in_progress', 0),
    (p7, 'Draft Plan', 'fixed', 420, 'not_started', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p8, 'Feature Survey', 'fixed', 4600, 'not_started', 0),
    (p8, 'DBYD Research', 'fixed', 280, 'not_started', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p9, 'Boundary Survey', 'fixed', 3600, 'in_progress', 0),
    (p9, 'Identification Survey', 'fixed', 2200, 'not_started', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p10, 'Sewer Design', 'fixed', 5800, 'in_progress', 0),
    (p10, 'DBYD Research', 'fixed', 280, 'completed', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p11, 'Contour & Detail Survey', 'fixed', 7200, 'on_hold', 0),
    (p11, 'DBYD Research', 'fixed', 280, 'not_started', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p12, 'Feature Survey', 'fixed', 4300, 'on_hold', 0);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p13, 'Boundary Survey', 'fixed', 5100, 'on_hold', 0),
    (p13, 'Draft Plan', 'fixed', 580, 'not_started', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p14, 'Identification Survey', 'fixed', 2900, 'on_hold', 0);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p15, 'Contour & Detail Survey', 'fixed', 4200, 'completed', 0),
    (p15, 'DBYD Research', 'fixed', 280, 'completed', 1),
    (p15, 'Draft Plan', 'fixed', 380, 'completed', 2);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p16, 'Feature Survey', 'fixed', 3800, 'completed', 0),
    (p16, 'Boundary Survey', 'fixed', 4100, 'completed', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p17, 'Identification Survey', 'fixed', 2600, 'completed', 0),
    (p17, 'Draft Plan', 'fixed', 320, 'completed', 1);

  INSERT INTO project_tasks (project_id, title, fee_type, quoted_amount, status, sort_order)
  VALUES
    (p18, 'Sewer Design', 'fixed', 8200, 'completed', 0),
    (p18, 'DBYD Research', 'fixed', 280, 'completed', 1);

  -- ============================================================
  -- 4. TIME ENTRIES (uses existing staff — skipped if none exist)
  -- ============================================================

  SELECT COUNT(*) > 0 INTO has_staff FROM staff_profiles WHERE is_active = true;

  IF has_staff THEN
    -- Active projects
    INSERT INTO time_entries (project_id, staff_id, date, hours, description, is_billable, rate_at_time)
    SELECT p1, sp.id, CURRENT_DATE - (floor(random() * 30) + 1)::int,
           round((2 + random() * 5)::numeric, 1), 'Field survey — Newstead', true, sp.default_hourly_rate
    FROM staff_profiles sp WHERE sp.is_active = true ORDER BY random() LIMIT 3;

    INSERT INTO time_entries (project_id, staff_id, date, hours, description, is_billable, rate_at_time)
    SELECT p2, sp.id, CURRENT_DATE - (floor(random() * 30) + 1)::int,
           round((1 + random() * 6)::numeric, 1), 'Field survey — Coolangatta', true, sp.default_hourly_rate
    FROM staff_profiles sp WHERE sp.is_active = true ORDER BY random() LIMIT 2;

    INSERT INTO time_entries (project_id, staff_id, date, hours, description, is_billable, rate_at_time)
    SELECT p3, sp.id, CURRENT_DATE - (floor(random() * 20) + 1)::int,
           round((3 + random() * 4)::numeric, 1), 'Identification survey — Springfield', true, sp.default_hourly_rate
    FROM staff_profiles sp WHERE sp.is_active = true ORDER BY random() LIMIT 3;

    INSERT INTO time_entries (project_id, staff_id, date, hours, description, is_billable, rate_at_time)
    SELECT p5, sp.id, CURRENT_DATE - (floor(random() * 25) + 1)::int,
           round((2 + random() * 5)::numeric, 1), 'Boundary survey — South Brisbane', true, sp.default_hourly_rate
    FROM staff_profiles sp WHERE sp.is_active = true ORDER BY random() LIMIT 2;

    INSERT INTO time_entries (project_id, staff_id, date, hours, description, is_billable, rate_at_time)
    SELECT p7, sp.id, CURRENT_DATE - (floor(random() * 35) + 1)::int,
           round((1 + random() * 6)::numeric, 1), 'Contour survey — Paddington', true, sp.default_hourly_rate
    FROM staff_profiles sp WHERE sp.is_active = true ORDER BY random() LIMIT 3;

    INSERT INTO time_entries (project_id, staff_id, date, hours, description, is_billable, rate_at_time)
    SELECT p9, sp.id, CURRENT_DATE - (floor(random() * 15) + 1)::int,
           round((2 + random() * 4)::numeric, 1), 'Boundary survey — Sunnybank', true, sp.default_hourly_rate
    FROM staff_profiles sp WHERE sp.is_active = true ORDER BY random() LIMIT 2;

    INSERT INTO time_entries (project_id, staff_id, date, hours, description, is_billable, rate_at_time)
    SELECT p10, sp.id, CURRENT_DATE - (floor(random() * 20) + 1)::int,
           round((3 + random() * 5)::numeric, 1), 'Sewer design — Coorparoo', true, sp.default_hourly_rate
    FROM staff_profiles sp WHERE sp.is_active = true ORDER BY random() LIMIT 3;

    -- Completed projects (historical entries)
    INSERT INTO time_entries (project_id, staff_id, date, hours, description, is_billable, rate_at_time)
    SELECT p15, sp.id, CURRENT_DATE - (floor(random() * 90) + 60)::int,
           round((2 + random() * 6)::numeric, 1), 'Contour survey — Fortitude Valley', true, sp.default_hourly_rate
    FROM staff_profiles sp WHERE sp.is_active = true ORDER BY random() LIMIT 4;

    INSERT INTO time_entries (project_id, staff_id, date, hours, description, is_billable, rate_at_time)
    SELECT p16, sp.id, CURRENT_DATE - (floor(random() * 90) + 60)::int,
           round((1 + random() * 5)::numeric, 1), 'Feature survey — Yeronga', true, sp.default_hourly_rate
    FROM staff_profiles sp WHERE sp.is_active = true ORDER BY random() LIMIT 3;

    INSERT INTO time_entries (project_id, staff_id, date, hours, description, is_billable, rate_at_time)
    SELECT p17, sp.id, CURRENT_DATE - (floor(random() * 90) + 60)::int,
           round((2 + random() * 4)::numeric, 1), 'Identification survey — Holland Park', true, sp.default_hourly_rate
    FROM staff_profiles sp WHERE sp.is_active = true ORDER BY random() LIMIT 2;

    INSERT INTO time_entries (project_id, staff_id, date, hours, description, is_billable, rate_at_time)
    SELECT p18, sp.id, CURRENT_DATE - (floor(random() * 90) + 60)::int,
           round((3 + random() * 6)::numeric, 1), 'Sewer design — Milton', true, sp.default_hourly_rate
    FROM staff_profiles sp WHERE sp.is_active = true ORDER BY random() LIMIT 4;
  END IF;

  -- ============================================================
  -- 5. QUOTES (Q-6001 to Q-6022)
  -- ============================================================

  -- Draft (8)
  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, notes)
  VALUES ('Q-6001', 'draft', c13, 'Paul Nguyen', '0455 456 789', 'paul.nguyen@outlook.com', '28 Mains Rd', 'Sunnybank', 'Contour & Detail Survey', 3600, 360, 3960, '[demo-seed]')
  RETURNING id INTO q1;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, notes)
  VALUES ('Q-6002', 'draft', c19, 'Chris Thornton', '0433 012 345', 'cthornton@gmail.com', '14 Beaudesert Rd', 'Moorooka', 'Identification Survey', 2800, 280, 3080, '[demo-seed]')
  RETURNING id INTO q2;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, notes)
  VALUES ('Q-6003', 'draft', c20, 'Rachel Kim', '0444 123 456', 'rachel.kim@gmail.com', '9 Sherwood Rd', 'Toowong', 'Feature Survey', 4200, 420, 4620, '[demo-seed]')
  RETURNING id INTO q3;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, notes)
  VALUES ('Q-6004', 'draft', c21, 'Daniel Russo', '0455 234 567', 'd.russo@icloud.com', '7 Montague Rd', 'West End', 'Boundary Survey', 5100, 510, 5610, '[demo-seed]')
  RETURNING id INTO q4;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, notes)
  VALUES ('Q-6005', 'draft', c22, 'Sandra O''Connor', '0466 345 678', 'soconnor@bigpond.com', '33 Station Rd', 'Indooroopilly', 'Contour & Detail Survey', 4800, 480, 5280, '[demo-seed]')
  RETURNING id INTO q5;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, notes)
  VALUES ('Q-6006', 'draft', c23, 'Michael Patel', '0477 456 789', 'michael.patel@gmail.com', '52 Creek Rd', 'Carindale', 'Feature Survey', 3900, 390, 4290, '[demo-seed]')
  RETURNING id INTO q6;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, notes)
  VALUES ('Q-6007', 'draft', c24, 'Amanda Stewart', '0488 567 890', 'amanda.stewart@outlook.com', '18 Kessels Rd', 'Mansfield', 'Identification Survey', 2600, 260, 2860, '[demo-seed]')
  RETURNING id INTO q7;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, notes)
  VALUES ('Q-6008', 'draft', c25, 'Thomas Walsh', '0411 678 901', 't.walsh@gmail.com', '5 Gardner Rd', 'Rochedale', 'Boundary Survey', 4400, 440, 4840, '[demo-seed]')
  RETURNING id INTO q8;

  -- Issued (6)
  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, valid_until, notes)
  VALUES ('Q-6009', 'issued', c1, 'James Henderson', '0411 234 567', 'james@hendersonpg.com.au', '88 Breakfast Creek Rd', 'Newstead', 'Feature Survey', 5500, 550, 6050, CURRENT_DATE + 45, '[demo-seed]')
  RETURNING id INTO q9;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, valid_until, notes)
  VALUES ('Q-6010', 'issued', c2, 'Rebecca Walsh', '0422 345 678', 'rebecca@coastaldev.com.au', '12 Griffith St', 'Coolangatta', 'Contour & Detail Survey', 6200, 620, 6820, CURRENT_DATE + 38, '[demo-seed]')
  RETURNING id INTO q10;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, valid_until, notes)
  VALUES ('Q-6011', 'issued', c5, 'Michael Torres', '0455 678 901', 'm.torres@summitdev.com.au', '55 Hanbury St', 'Hamilton', 'Boundary Survey', 4700, 470, 5170, CURRENT_DATE + 52, '[demo-seed]')
  RETURNING id INTO q11;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, valid_until, notes)
  VALUES ('Q-6012', 'issued', c8, 'Emma Richardson', '0488 901 234', 'emma@skylineproperty.com.au', '7 Hamilton Rd', 'Chermside', 'Identification Survey', 3100, 310, 3410, CURRENT_DATE + 29, '[demo-seed]')
  RETURNING id INTO q12;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, valid_until, notes)
  VALUES ('Q-6013', 'issued', c10, 'Natalie Foster', '0422 123 456', 'natalie@horizonlandgroup.com.au', '25 Park Rd', 'Milton', 'Sewer Design', 7800, 780, 8580, CURRENT_DATE + 60, '[demo-seed]')
  RETURNING id INTO q13;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, valid_until, notes)
  VALUES ('Q-6014', 'issued', c14, 'Margaret Wilson', '0466 567 890', 'mwilson@bigpond.com', '4 Grace St', 'Graceville', 'Feature Survey', 4100, 410, 4510, CURRENT_DATE + 21, '[demo-seed]')
  RETURNING id INTO q14;

  -- Accepted (5) — linked to projects
  INSERT INTO quotes (quote_number, status, client_id, project_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, approved_at, notes)
  VALUES ('Q-6015', 'accepted', c1, p1, 'James Henderson', '0411 234 567', 'james@hendersonpg.com.au', '14 James St', 'Newstead', 'Contour & Detail Survey', 4800, 480, 5280, NOW() - INTERVAL '25 days', '[demo-seed]')
  RETURNING id INTO q15;

  INSERT INTO quotes (quote_number, status, client_id, project_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, approved_at, notes)
  VALUES ('Q-6016', 'accepted', c2, p2, 'Rebecca Walsh', '0422 345 678', 'rebecca@coastaldev.com.au', '8 Marine Pde', 'Coolangatta', 'Feature Survey', 5200, 520, 5720, NOW() - INTERVAL '18 days', '[demo-seed]')
  RETURNING id INTO q16;

  INSERT INTO quotes (quote_number, status, client_id, project_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, approved_at, notes)
  VALUES ('Q-6017', 'accepted', c3, p3, 'David Chen', '0433 456 789', 'david.chen@pinnaclehomes.com.au', '42 Pinnacle Dr', 'Springfield', 'Identification Survey', 2800, 280, 3080, NOW() - INTERVAL '30 days', '[demo-seed]')
  RETURNING id INTO q17;

  INSERT INTO quotes (quote_number, status, client_id, project_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, approved_at, notes)
  VALUES ('Q-6018', 'accepted', c7, p5, 'Tom Murray', '0477 890 123', 'tom.murray@blueprintarch.com.au', '3 Tribune St', 'South Brisbane', 'Boundary Survey', 4100, 410, 4510, NOW() - INTERVAL '12 days', '[demo-seed]')
  RETURNING id INTO q18;

  INSERT INTO quotes (quote_number, status, client_id, project_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, approved_at, notes)
  VALUES ('Q-6019', 'accepted', c9, p10, 'Greg Lawson', '0411 012 345', 'greg.lawson@pacificconstruct.com.au', '6 Old Cleveland Rd', 'Coorparoo', 'Sewer Design', 5800, 580, 6380, NOW() - INTERVAL '8 days', '[demo-seed]')
  RETURNING id INTO q19;

  -- Declined (3)
  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, notes)
  VALUES ('Q-6020', 'declined', c11, 'Robert Sinclair', '0433 234 567', 'robert.sinclair@gmail.com', '55 Latrobe Tce', 'Paddington', 'Contour & Detail Survey', 5200, 520, 5720, '[demo-seed]')
  RETURNING id INTO q20;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, notes)
  VALUES ('Q-6021', 'declined', c15, 'Steven Abbott', '0477 678 901', 's.abbott@gmail.com', '63 Moggill Rd', 'Kenmore', 'Boundary Survey', 4600, 460, 5060, '[demo-seed]')
  RETURNING id INTO q21;

  INSERT INTO quotes (quote_number, status, client_id, contact_name, contact_phone, contact_email, site_address, suburb, job_type, subtotal, gst_amount, total, notes)
  VALUES ('Q-6022', 'declined', c16, 'Lisa Chang', '0488 789 012', 'lisa.chang@icloud.com', '5 Swann Rd', 'Taringa', 'Feature Survey', 3800, 380, 4180, '[demo-seed]')
  RETURNING id INTO q22;

  -- ============================================================
  -- 6. QUOTE ITEMS
  -- ============================================================

  INSERT INTO quote_items (quote_id, description, quantity, unit_price, sort_order) VALUES
    (q1,  'Contour & Detail Survey', 1, 3600, 0),
    (q2,  'Identification Survey',   1, 2800, 0),
    (q3,  'Feature Survey',          1, 4200, 0),
    (q4,  'Boundary Survey',         1, 5100, 0),
    (q5,  'Contour & Detail Survey', 1, 4800, 0),
    (q6,  'Feature Survey',          1, 3900, 0),
    (q7,  'Identification Survey',   1, 2600, 0),
    (q8,  'Boundary Survey',         1, 4400, 0),
    (q9,  'Feature Survey',          1, 5500, 0),
    (q10, 'Contour & Detail Survey', 1, 6200, 0),
    (q11, 'Boundary Survey',         1, 4700, 0),
    (q12, 'Identification Survey',   1, 3100, 0),
    (q13, 'Sewer Design',            1, 7800, 0),
    (q14, 'Feature Survey',          1, 4100, 0),
    (q15, 'Contour & Detail Survey', 1, 4800, 0),
    (q16, 'Feature Survey',          1, 5200, 0),
    (q17, 'Identification Survey',   1, 2800, 0),
    (q18, 'Boundary Survey',         1, 4100, 0),
    (q19, 'Sewer Design',            1, 5800, 0),
    (q20, 'Contour & Detail Survey', 1, 5200, 0),
    (q21, 'Boundary Survey',         1, 4600, 0),
    (q22, 'Feature Survey',          1, 3800, 0);

END $$;
