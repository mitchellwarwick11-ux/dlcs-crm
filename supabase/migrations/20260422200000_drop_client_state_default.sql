-- The initial schema defaulted clients.state to 'QLD', which meant the quick
-- New Client modal (and any other insert that skips state) silently stamped 'QLD'
-- onto every new client. Drop the default so blank stays blank.
ALTER TABLE clients ALTER COLUMN state DROP DEFAULT;
