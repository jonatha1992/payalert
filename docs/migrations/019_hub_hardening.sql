alter table public.hub_charges add column if not exists init_point text;
alter table public.hub_charges drop constraint if exists hub_charges_status_check;
alter table public.hub_charges add constraint hub_charges_status_check check (status in ('creating','pending','approved','rejected','expired','refunded','needs_refund'));
alter table public.hub_charges drop constraint if exists hub_charges_client_app_id_booking_id_key;
alter table public.hub_charges add constraint hub_charges_client_app_id_booking_id_key unique (client_app_id, booking_id);
revoke all on public.client_apps from anon, authenticated;
revoke all on public.hub_charges from anon, authenticated;
