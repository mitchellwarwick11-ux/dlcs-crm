CREATE TABLE IF NOT EXISTS company_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

INSERT INTO company_settings (key, value) VALUES
  ('company_name',    'Delfs Lascelles Consulting Surveyors'),
  ('abn',             ''),
  ('bank_name',       ''),
  ('bsb',             ''),
  ('account_number',  ''),
  ('account_name',    '')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can read company settings' AND tablename = 'company_settings'
  ) THEN
    CREATE POLICY "Auth users can read company settings"
    ON company_settings FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can update company settings' AND tablename = 'company_settings'
  ) THEN
    CREATE POLICY "Auth users can update company settings"
    ON company_settings FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;
