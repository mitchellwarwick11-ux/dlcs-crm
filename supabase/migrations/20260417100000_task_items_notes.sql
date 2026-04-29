-- Add notes column to task_items for longer-form notes beyond the short description.
alter table task_items
  add column if not exists notes text;
