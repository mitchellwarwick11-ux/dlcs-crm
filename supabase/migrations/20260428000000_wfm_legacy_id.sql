-- ============================================================
-- WFM LEGACY ID COLUMNS
-- Added to imported tables so the WFM import pipeline is
-- idempotent (UPSERT keyed on wfm_legacy_id) and so any
-- imported row can be traced back to its WorkflowMax source.
--
-- Format examples:
--   wfm:client:Ampol Australia Petroleum Pty Ltd
--   wfm:contact:<client>|<contact_name>
--   wfm:job:21887
--   wfm:invoice:INV-21520
--   wfm:invoice_item:INV-21520|Surveying Assistant (non billable)
--   wfm:time:<sha1 of job|staff|date|hours|note>
-- ============================================================

ALTER TABLE clients          ADD COLUMN wfm_legacy_id TEXT UNIQUE;
ALTER TABLE client_contacts  ADD COLUMN wfm_legacy_id TEXT UNIQUE;
ALTER TABLE projects         ADD COLUMN wfm_legacy_id TEXT UNIQUE;
ALTER TABLE time_entries     ADD COLUMN wfm_legacy_id TEXT UNIQUE;
ALTER TABLE invoices         ADD COLUMN wfm_legacy_id TEXT UNIQUE;
ALTER TABLE invoice_items    ADD COLUMN wfm_legacy_id TEXT UNIQUE;

CREATE INDEX idx_clients_wfm_legacy_id         ON clients(wfm_legacy_id)         WHERE wfm_legacy_id IS NOT NULL;
CREATE INDEX idx_client_contacts_wfm_legacy_id ON client_contacts(wfm_legacy_id) WHERE wfm_legacy_id IS NOT NULL;
CREATE INDEX idx_projects_wfm_legacy_id        ON projects(wfm_legacy_id)        WHERE wfm_legacy_id IS NOT NULL;
CREATE INDEX idx_time_entries_wfm_legacy_id    ON time_entries(wfm_legacy_id)    WHERE wfm_legacy_id IS NOT NULL;
CREATE INDEX idx_invoices_wfm_legacy_id        ON invoices(wfm_legacy_id)        WHERE wfm_legacy_id IS NOT NULL;
CREATE INDEX idx_invoice_items_wfm_legacy_id   ON invoice_items(wfm_legacy_id)   WHERE wfm_legacy_id IS NOT NULL;

-- ============================================================
-- WFM IMPORT LOG
-- Audit trail for every load / transform / reset run.
-- ============================================================

CREATE TABLE wfm_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  stage TEXT NOT NULL,         -- 'load' | 'validate' | 'transform' | 'reset'
  step TEXT NOT NULL,          -- e.g. 'clients', 'time_entries', 'link_invoice_items'
  status TEXT NOT NULL,        -- 'ok' | 'warn' | 'error'
  message TEXT,
  row_count INT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wfm_import_log_batch_id ON wfm_import_log(batch_id);
CREATE INDEX idx_wfm_import_log_created_at ON wfm_import_log(created_at DESC);

ALTER TABLE wfm_import_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_wfm_import_log" ON wfm_import_log FOR SELECT TO authenticated USING (true);
