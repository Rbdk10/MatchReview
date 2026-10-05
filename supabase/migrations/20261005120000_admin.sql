-- Admin accounts can read and manage every team. The flag can only be set from the database.
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Clients may no longer write is_admin (or any column not listed here).
revoke insert, update on public.profiles from authenticated, anon;
grant insert (id, full_name) on public.profiles to authenticated;
grant update (full_name, team_name, sport, onboarded, role) on public.profiles to authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create policy "profiles: admin all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());
create policy "players: admin all" on public.players
  for all using (public.is_admin()) with check (public.is_admin());
create policy "opponents: admin all" on public.opponents
  for all using (public.is_admin()) with check (public.is_admin());
create policy "results: admin all" on public.results
  for all using (public.is_admin()) with check (public.is_admin());
create policy "invites: admin all" on public.player_invites
  for all using (public.is_admin()) with check (public.is_admin());
