alter table public.client_apps
  alter column firebase_project_id drop not null,
  alter column firebase_sa_encrypted drop not null;

alter table public.hub_charges
  add column if not exists payer_ref text,
  add column if not exists booking_status text,
  add column if not exists return_url text;
