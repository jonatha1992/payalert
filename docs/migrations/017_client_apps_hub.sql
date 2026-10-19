create table if not exists public.client_apps (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  api_key_hash text not null, allowed_origins text[] not null default '{}',
  connection_id uuid not null references public.payment_connections(id),
  firebase_project_id text not null, firebase_sa_encrypted text not null,
  admin_emails text[] not null default '{}', deposit_default integer not null default 5000 check (deposit_default between 1 and 1000000),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.hub_charges (
  id uuid primary key default gen_random_uuid(), client_app_id uuid not null references public.client_apps(id) on delete cascade,
  booking_id text not null, external_reference text not null unique, amount integer not null check (amount between 1 and 1000000),
  currency text not null default 'ARS', preference_id text, payment_id text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','refunded','needs_refund')),
  expires_at timestamptz not null, idempotency_key text not null unique,
  firestore_synced boolean not null default false, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(client_app_id, booking_id)
);
alter table public.client_apps enable row level security;
alter table public.hub_charges enable row level security;
create index if not exists hub_charges_pending_expiry on public.hub_charges(expires_at) where status = 'pending';
create index if not exists hub_charges_firestore_retry on public.hub_charges(updated_at) where firestore_synced = false;
