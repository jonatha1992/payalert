alter table public.payment_connections
  add column if not exists last_sync_source text;

comment on column public.payment_connections.last_sync_source is
  'Origin of the most recent provider query recorded for this connection.';
