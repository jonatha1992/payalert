-- OAuth state is short-lived, tenant-bound, and consumed atomically.
create table if not exists public.mp_oauth_states (
  state_hash text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  nonce_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mp_oauth_states_expiry_idx on public.mp_oauth_states (expires_at);
alter table public.mp_oauth_states enable row level security;
