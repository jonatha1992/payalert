alter table public.hub_charges add column if not exists init_point text;
alter table public.hub_charges drop constraint if exists hub_charges_status_check;
alter table public.hub_charges add constraint hub_charges_status_check check (status in ('creating','pending','approved','rejected','expired','refunding','refunded','needs_refund'));
alter table public.hub_charges drop constraint if exists hub_charges_client_app_id_booking_id_key;
alter table public.hub_charges add constraint hub_charges_client_app_id_booking_id_key unique (client_app_id, booking_id);
alter table public.payment_connections drop constraint if exists payment_connections_id_business_id_key;
alter table public.payment_connections add constraint payment_connections_id_business_id_key unique (id, business_id);
alter table public.client_apps drop constraint if exists client_apps_connection_id_fkey;
alter table public.client_apps drop constraint if exists client_apps_connection_business_fkey;
alter table public.client_apps add constraint client_apps_connection_business_fkey
  foreign key (connection_id, business_id) references public.payment_connections(id, business_id);
revoke all on public.client_apps from anon, authenticated;
revoke all on public.hub_charges from anon, authenticated;
