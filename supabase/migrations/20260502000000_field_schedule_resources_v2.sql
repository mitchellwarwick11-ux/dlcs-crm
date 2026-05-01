-- Field Schedule resource list = exactly: Assistant, Level, UAV, GNSS, Scanner
--
-- Strategy: insert/upsert the desired five (active, in order), and deactivate
-- anything else. Rows are NOT deleted — existing field_schedule_resources
-- bookings keep their links (would otherwise CASCADE-delete).
-- Re-runnable.

INSERT INTO schedule_equipment (label, sort_order, is_active) VALUES
  ('Assistant', 1, TRUE),
  ('Level',     2, TRUE),
  ('UAV',       3, TRUE),
  ('GNSS',      4, TRUE),
  ('Scanner',   5, TRUE)
ON CONFLICT (label) DO UPDATE
  SET sort_order = EXCLUDED.sort_order,
      is_active  = TRUE;

UPDATE schedule_equipment
   SET is_active = FALSE
 WHERE label NOT IN ('Assistant','Level','UAV','GNSS','Scanner');
