-- Link invoice items to tasks
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prev_claimed_amount NUMERIC(10,2);
-- prev_claimed_amount: snapshot of task's claimed_amount BEFORE this invoice was created
-- Used to show correct Quoted/Prev Claimed/This Claim/Remaining breakdown on historical PDFs

-- Track cumulative amount claimed against each task across all invoices
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS claimed_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Storage bucket for project documents (run this if bucket doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for project-documents bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can upload project documents' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can upload project documents"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'project-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can read project documents' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can read project documents"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'project-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can delete project documents' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can delete project documents"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'project-documents');
  END IF;
END $$;
