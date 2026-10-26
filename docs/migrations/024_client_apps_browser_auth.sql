alter table public.client_apps
  add column if not exists firebase_project_id text;

alter table public.client_apps
  add column if not exists owner_emails text[] not null default '{}';
