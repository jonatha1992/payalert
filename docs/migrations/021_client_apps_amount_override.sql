alter table public.client_apps
  add column if not exists allow_amount_override boolean not null default false,
  add column if not exists min_amount integer not null default 1,
  add column if not exists max_amount integer not null default 1000000;

alter table public.client_apps
  drop constraint if exists client_apps_amount_bounds_check;

alter table public.client_apps
  add constraint client_apps_amount_bounds_check
  check (min_amount >= 1 and max_amount >= min_amount and max_amount <= 1000000);
