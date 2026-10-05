-- Lets a signed-in user delete their own account (App Store guideline 5.1.1(v)).
-- Deleting the auth user cascades through profiles:
--   * a coach's team goes with it: players, staff, invites, opponents and results;
--   * a player or staff account is unlinked (user_id set null), and the coach keeps the spot and its results.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
