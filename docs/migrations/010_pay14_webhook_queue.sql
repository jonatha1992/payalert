create table if not exists public.webhook_events (
  id uuid primary key,
  provider text not null,
  connection_id uuid not null,
  dedupe_key text not null,
  payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','DONE','FAILED','DEAD')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, dedupe_key)
);
create index if not exists webhook_events_status_next_attempt_idx on public.webhook_events(status, next_attempt_at);
alter table public.webhook_events enable row level security;
drop policy if exists webhook_events_service_role_only on public.webhook_events;
create policy webhook_events_service_role_only on public.webhook_events for all to service_role using (true) with check (true);

create or replace function public.claim_webhook_events(
  p_limit int,
  p_now timestamptz,
  p_locked_before timestamptz
)
returns setof public.webhook_events
language sql
security definer
set search_path = pg_catalog, public
as $$
  with candidates as (
    select e.id
    from public.webhook_events as e
    where (e.status in ('PENDING', 'FAILED') and e.next_attempt_at <= p_now)
       or (e.status = 'PROCESSING' and e.locked_at < p_locked_before)
    order by e.next_attempt_at, e.created_at
    limit p_limit
    for update of e skip locked
  ), claimed as (
    update public.webhook_events as e
    set status = 'PROCESSING', locked_at = p_now, updated_at = p_now
    from candidates as c
    where e.id = c.id
    returning e.*
  )
  select * from claimed;
$$;

create or replace function public.webhook_queue_metrics(p_now timestamptz)
returns table (pending bigint, dead bigint, oldest_pending_age_seconds double precision)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    count(*) filter (where e.status in ('PENDING', 'FAILED')) as pending,
    count(*) filter (where e.status = 'DEAD') as dead,
    coalesce(extract(epoch from (p_now - min(e.created_at) filter (where e.status in ('PENDING', 'FAILED')))), 0)::double precision as oldest_pending_age_seconds
  from public.webhook_events as e;
$$;

revoke execute on function public.claim_webhook_events(int, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.webhook_queue_metrics(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_webhook_events(int, timestamptz, timestamptz) to service_role;
grant execute on function public.webhook_queue_metrics(timestamptz) to service_role;
