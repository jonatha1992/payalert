alter table public.hub_charges drop constraint if exists hub_charges_status_check;
alter table public.hub_charges add constraint hub_charges_status_check
  check (status in ('creating','pending','approved','rejected','expired','refunding','refunded','needs_refund'));
