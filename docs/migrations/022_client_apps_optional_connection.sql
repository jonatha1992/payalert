BEGIN;

ALTER TABLE public.client_apps
  ALTER COLUMN connection_id DROP NOT NULL;

COMMIT;
