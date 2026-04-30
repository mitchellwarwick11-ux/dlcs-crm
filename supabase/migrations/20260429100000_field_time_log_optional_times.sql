-- Allow surveyors to log just hours onsite without start/end times.
-- The form now offers a choice between (a) start + end times or (b) hours only.

ALTER TABLE field_time_logs ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE field_time_logs ALTER COLUMN end_time   DROP NOT NULL;
