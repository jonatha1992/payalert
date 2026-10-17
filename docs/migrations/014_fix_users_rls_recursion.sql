-- 014: corrige "infinite recursion detected in policy for relation users" (42P17).
-- Las politicas de public.users consultaban public.users. Se reemplazan por helpers SECURITY DEFINER
-- (leen sin pasar por RLS). Rerunnable.
create or replace function public.current_user_business_id() returns uuid
language sql stable security definer set search_path = public as
$$ select business_id from public.users where id = auth.uid() $$;

create or replace function public.current_user_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.users where id = auth.uid() $$;

revoke all on function public.current_user_business_id() from public;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_business_id() to authenticated, service_role;
grant execute on function public.current_user_role() to authenticated, service_role;

drop policy if exists users_admin_all on public.users;
drop policy if exists users_owner_all on public.users;
drop policy if exists users_select_own_business on public.users;

create policy users_admin_all on public.users for all
  using (public.current_user_role() = 'admin');
create policy users_owner_all on public.users for all
  using (business_id = public.current_user_business_id() and public.current_user_role() = 'owner');
create policy users_select_own_business on public.users for select
  using (id = auth.uid() or business_id = public.current_user_business_id());
