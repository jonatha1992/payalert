-- Single-use client-app connection links. Only service_role may access this table.
create table if not exists public.client_app_connect_links (
  id uuid primary key default gen_random_uuid(),
  client_app_id uuid not null references public.client_apps(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_app_connect_links_app_expiry_idx
  on public.client_app_connect_links (client_app_id, expires_at)
  where used_at is null;

alter table public.client_app_connect_links enable row level security;
-- Intentionally no anon/authenticated policies; backend access uses service_role.

alter table public.mp_oauth_states alter column user_id drop not null;
alter table public.mp_oauth_states add column if not exists connect_link_id uuid null
  references public.client_app_connect_links(id) on delete cascade;

-- Invalidate previous links and create the new one in one transaction.
create or replace function public.create_client_app_connect_link(
  p_client_app_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  update public.client_app_connect_links
    set expires_at = now()
    where client_app_id = p_client_app_id and used_at is null and expires_at > now();
  insert into public.client_app_connect_links (client_app_id, token_hash, expires_at, created_by)
    values (p_client_app_id, p_token_hash, p_expires_at, p_created_by)
    returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_client_app_connect_link(uuid, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.create_client_app_connect_link(uuid, text, timestamptz, uuid) to service_role;
