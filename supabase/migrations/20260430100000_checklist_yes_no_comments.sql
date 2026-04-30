-- Add Yes/No/Comments responses to checklist submissions, plus a
-- submitted_at timestamp marking when the surveyor pressed Submit
-- (which generates the PDF and uploads it to project Documents).
ALTER TABLE checklist_submissions
  ADD COLUMN IF NOT EXISTS responses JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- responses shape: [{ item_id: string, answer: 'yes' | 'no', comment: string }]
