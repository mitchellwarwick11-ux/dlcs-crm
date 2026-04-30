-- ============================================================
-- WFM STAGING TABLES
-- These tables hold raw, unmodified rows from the WorkflowMax
-- CSV exports. Stage 1 of the import populates them; Stage 2
-- (transform) reads them and writes to the live app tables.
--
-- Design rules:
--   * `raw` is the entire CSV row as JSONB (canonical source).
--   * Denormalized columns exist only for SQL convenience
--     (joins, filtering) -- they are derived from `raw`.
--   * No FKs between staging tables -- the data is messy and
--     we don't want to reject rows during load.
--   * `batch_id` lets multiple import attempts coexist if needed.
-- ============================================================

CREATE TABLE wfm_clients_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  row_num INT NOT NULL,
  raw JSONB NOT NULL,
  client_name TEXT,
  contact_name TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wfm_clients_raw_batch ON wfm_clients_raw(batch_id);
CREATE INDEX idx_wfm_clients_raw_client ON wfm_clients_raw(client_name);

CREATE TABLE wfm_jobs_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  row_num INT NOT NULL,
  raw JSONB NOT NULL,
  job_no TEXT,
  client_name TEXT,
  job_status TEXT,
  date_created TEXT,        -- raw text; transform parses to DATE
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wfm_jobs_raw_batch ON wfm_jobs_raw(batch_id);
CREATE INDEX idx_wfm_jobs_raw_job_no ON wfm_jobs_raw(job_no);

CREATE TABLE wfm_time_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  row_num INT NOT NULL,
  raw JSONB NOT NULL,
  job_no TEXT,
  staff_name TEXT,
  time_date TEXT,           -- raw text
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wfm_time_raw_batch ON wfm_time_raw(batch_id);
CREATE INDEX idx_wfm_time_raw_job_no ON wfm_time_raw(job_no);

CREATE TABLE wfm_invoiced_time_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  row_num INT NOT NULL,
  raw JSONB NOT NULL,
  invoice_no TEXT,
  job_no TEXT,
  staff_name TEXT,
  time_date TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wfm_invoiced_time_raw_batch ON wfm_invoiced_time_raw(batch_id);
CREATE INDEX idx_wfm_invoiced_time_raw_invoice ON wfm_invoiced_time_raw(invoice_no);
CREATE INDEX idx_wfm_invoiced_time_raw_job ON wfm_invoiced_time_raw(job_no);

CREATE TABLE wfm_invoices_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  row_num INT NOT NULL,
  raw JSONB NOT NULL,
  invoice_no TEXT,
  job_numbers TEXT,         -- WFM emits comma-separated when multi-job
  client_name TEXT,
  invoice_date TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wfm_invoices_raw_batch ON wfm_invoices_raw(batch_id);
CREATE INDEX idx_wfm_invoices_raw_invoice ON wfm_invoices_raw(invoice_no);

ALTER TABLE wfm_clients_raw        ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfm_jobs_raw           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfm_time_raw           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfm_invoiced_time_raw  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfm_invoices_raw       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_wfm_clients_raw"       ON wfm_clients_raw       FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_wfm_jobs_raw"          ON wfm_jobs_raw          FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_wfm_time_raw"          ON wfm_time_raw          FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_wfm_invoiced_time_raw" ON wfm_invoiced_time_raw FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_wfm_invoices_raw"      ON wfm_invoices_raw      FOR SELECT TO authenticated USING (true);
