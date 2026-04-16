-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'administration',
  'registered_surveyor',
  'office_surveyor',
  'drafting',
  'sewer_water_designer'
);

CREATE TYPE project_status AS ENUM (
  'active',
  'on_hold',
  'completed',
  'cancelled',
  'archived'
);

CREATE TYPE job_type AS ENUM (
  'boundary_survey',
  'feature_survey',
  'subdivision',
  'identification_survey',
  'easement',
  'sewer_water_design',
  'building_format_plan',
  'community_title',
  'other'
);

CREATE TYPE quote_status AS ENUM (
  'draft',
  'sent',
  'approved',
  'declined',
  'invoiced'
);

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled'
);

CREATE TYPE task_status AS ENUM (
  'todo',
  'in_progress',
  'blocked',
  'done'
);

-- ============================================================
-- STAFF PROFILES
-- Links to Supabase Auth users
-- ============================================================

CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'drafting',
  default_hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLIENTS
-- ============================================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  suburb TEXT,
  state TEXT DEFAULT 'QLD',
  postcode TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- JOB NUMBER SEQUENCE TRACKING
-- ============================================================

CREATE TABLE job_number_sequences (
  year SMALLINT PRIMARY KEY,
  last_sequence INT NOT NULL DEFAULT 0
);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number TEXT NOT NULL UNIQUE,
  year SMALLINT NOT NULL,
  sequence INT NOT NULL,
  job_type job_type NOT NULL,
  status project_status NOT NULL DEFAULT 'active',
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  site_address TEXT,
  suburb TEXT,
  lot_number TEXT,
  plan_number TEXT,
  local_authority TEXT,
  purchase_order_number TEXT,
  is_billable BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_job_number ON projects(job_number);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_year ON projects(year);

-- ============================================================
-- PROJECT CONTACTS
-- ============================================================

CREATE TABLE project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_contacts_project_id ON project_contacts(project_id);

-- ============================================================
-- PROJECT STAFF RATE OVERRIDES
-- ============================================================

CREATE TABLE project_staff_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  hourly_rate NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, staff_id)
);

-- ============================================================
-- PROJECT TASKS
-- ============================================================

CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  assigned_to UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_assigned_to ON project_tasks(assigned_to);

-- ============================================================
-- TIME ENTRIES
-- ============================================================

CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours NUMERIC(5, 2) NOT NULL CHECK (hours > 0),
  description TEXT,
  is_billable BOOLEAN NOT NULL DEFAULT TRUE,
  rate_at_time NUMERIC(10, 2) NOT NULL,
  invoice_item_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX idx_time_entries_staff_id ON time_entries(staff_id);
CREATE INDEX idx_time_entries_date ON time_entries(date);

-- ============================================================
-- QUOTES
-- ============================================================

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL UNIQUE,
  status quote_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  gst_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  valid_until DATE,
  sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_project_id ON quotes(project_id);

-- ============================================================
-- QUOTE ITEMS
-- ============================================================

CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  amount NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  status invoice_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  gst_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  due_date DATE,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_project_id ON invoices(project_id);

-- ============================================================
-- INVOICE ITEMS
-- ============================================================

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  amount NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Add FK from time_entries to invoice_items
ALTER TABLE time_entries
  ADD CONSTRAINT fk_time_entries_invoice_item
  FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id) ON DELETE SET NULL;

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_project_id ON documents(project_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_staff_profiles_updated_at
  BEFORE UPDATE ON staff_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- JOB NUMBER GENERATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TEXT AS $$
DECLARE
  current_year SMALLINT;
  current_year_2digit TEXT;
  next_sequence INT;
  new_job_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::SMALLINT;
  current_year_2digit := TO_CHAR(current_year, 'YY');

  INSERT INTO job_number_sequences (year, last_sequence)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_sequence = job_number_sequences.last_sequence + 1
  RETURNING last_sequence INTO next_sequence;

  IF next_sequence <= 999 THEN
    new_job_number := current_year_2digit || LPAD(next_sequence::TEXT, 3, '0');
  ELSE
    new_job_number := current_year_2digit || next_sequence::TEXT;
  END IF;

  RETURN new_job_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- AUTO-CREATE STAFF PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO staff_profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'drafting'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_staff_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_staff_profiles" ON staff_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_clients" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_project_contacts" ON project_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_project_staff_rates" ON project_staff_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_project_tasks" ON project_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_time_entries" ON time_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_quotes" ON quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_quote_items" ON quote_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_invoices" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_invoice_items" ON invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_documents" ON documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_write_clients" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_projects" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_project_contacts" ON project_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_project_tasks" ON project_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_project_staff_rates" ON project_staff_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_time_entries" ON time_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_quotes" ON quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_quote_items" ON quote_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_invoices" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_invoice_items" ON invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_documents" ON documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_own_staff_profile_update" ON staff_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "auth_own_staff_profile_insert" ON staff_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
