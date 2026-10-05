-- Staff: assistant coaches, team managers and SIDs. A coach adds a staff spot with a role,
-- then invites someone to claim it through the same /join/<token> link players use.
-- Staff work with the whole team's results and opponents; only the head coach manages
-- the roster and staff.

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end $$;
alter table public.profiles
  add constraint profiles_role_check check (role in ('coach','player','staff'));

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  role text not null check (role in ('assistant_coach','team_manager','sid')),
  user_id uuid unique references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index staff_coach_idx on public.staff(coach_id);
alter table public.staff enable row level security;

create table public.staff_invites (
  staff_id uuid primary key references public.staff(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.staff_invites enable row level security;

create or replace function public.my_staff_coach_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coach_id from public.staff where user_id = auth.uid() limit 1
$$;

-- Staff table: the coach manages it; staff and players on the team can see who's on staff.
create policy "staff: coach manages own" on public.staff
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "staff: team read" on public.staff
  for select using (coach_id = public.my_staff_coach_id() or coach_id = public.my_coach_id());
create policy "staff: admin all" on public.staff
  for all using (public.is_admin()) with check (public.is_admin());

revoke insert, update on public.staff from authenticated, anon;
grant insert (coach_id, name, role) on public.staff to authenticated;
grant update (name, role) on public.staff to authenticated;

create policy "staff invites: coach manages own" on public.staff_invites
  for all using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.staff s
      where s.id = staff_id and s.coach_id = auth.uid() and s.user_id is null
    )
  );
create policy "staff invites: admin all" on public.staff_invites
  for all using (public.is_admin()) with check (public.is_admin());

-- What staff can do on their team.
create policy "players: staff read" on public.players
  for select using (coach_id = public.my_staff_coach_id());
create policy "opponents: staff all" on public.opponents
  for all using (coach_id = public.my_staff_coach_id())
  with check (coach_id = public.my_staff_coach_id());
create policy "results: staff all" on public.results
  for all using (coach_id = public.my_staff_coach_id())
  with check (coach_id = public.my_staff_coach_id());

-- Invite preview now covers both kinds of spot.
create or replace function public.invite_preview(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object(
       'kind', 'player',
       'player_name', p.name,
       'staff_role', null,
       'team_name', pr.team_name,
       'coach_name', pr.full_name)
     from public.player_invites i
     join public.players p on p.id = i.player_id
     join public.profiles pr on pr.id = i.coach_id
     where i.token = p_token and p.user_id is null),
    (select json_build_object(
       'kind', 'staff',
       'player_name', s.name,
       'staff_role', s.role,
       'team_name', pr.team_name,
       'coach_name', pr.full_name)
     from public.staff_invites i
     join public.staff s on s.id = i.staff_id
     join public.profiles pr on pr.id = i.coach_id
     where i.token = p_token and s.user_id is null)
  )
$$;

create or replace function public.claim_invite(p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_inv public.player_invites;
  v_sinv public.staff_invites;
  v_player public.players;
  v_staff public.staff;
  v_coach_id uuid;
  v_coach public.profiles;
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;

  select * into v_inv from public.player_invites where token = p_token;
  if found then
    v_coach_id := v_inv.coach_id;
  else
    select * into v_sinv from public.staff_invites where token = p_token;
    if not found then raise exception 'This invite link is invalid or has already been used.'; end if;
    v_coach_id := v_sinv.coach_id;
  end if;

  if v_coach_id = v_uid then raise exception 'You cannot claim a spot on your own team.'; end if;
  if exists (select 1 from public.players where user_id = v_uid)
     or exists (select 1 from public.staff where user_id = v_uid) then
    raise exception 'This account is already on a team.';
  end if;
  if not v_admin and (
       exists (select 1 from public.players where coach_id = v_uid)
       or exists (select 1 from public.results where coach_id = v_uid)) then
    raise exception 'This account already coaches a team. Use a different Google account to join.';
  end if;

  select * into v_coach from public.profiles where id = v_coach_id;

  if v_inv.player_id is not null then
    select * into v_player from public.players where id = v_inv.player_id for update;
    if v_player.user_id is not null then raise exception 'This spot has already been claimed.'; end if;
    update public.players set user_id = v_uid, claimed_at = now() where id = v_player.id;
    delete from public.player_invites where player_id = v_player.id;
  else
    select * into v_staff from public.staff where id = v_sinv.staff_id for update;
    if v_staff.user_id is not null then raise exception 'This spot has already been claimed.'; end if;
    update public.staff set user_id = v_uid, claimed_at = now() where id = v_staff.id;
    delete from public.staff_invites where staff_id = v_staff.id;
  end if;

  insert into public.profiles (id, full_name, role, onboarded, sport, team_name)
  values (v_uid, coalesce(v_player.name, v_staff.name),
          case when v_player.id is not null then 'player' else 'staff' end,
          true, v_coach.sport, v_coach.team_name)
  on conflict (id) do update set
    role = excluded.role,
    onboarded = true,
    sport = excluded.sport,
    team_name = excluded.team_name,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);

  return json_build_object(
    'kind', case when v_player.id is not null then 'player' else 'staff' end,
    'player_id', v_player.id, 'staff_id', v_staff.id,
    'player_name', coalesce(v_player.name, v_staff.name),
    'team_name', v_coach.team_name, 'coach_id', v_coach_id);
end;
$$;

-- Coach frees a claimed staff spot again.
create or replace function public.unlink_staff(p_staff_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_old uuid;
begin
  select user_id into v_old from public.staff
  where id = p_staff_id and (coach_id = auth.uid() or public.is_admin());
  if not found then raise exception 'Staff member not found.'; end if;
  update public.staff set user_id = null, claimed_at = null where id = p_staff_id;
  if v_old is not null then
    update public.profiles set role = 'coach', onboarded = false, team_name = null where id = v_old;
  end if;
end;
$$;

revoke execute on function public.unlink_staff(uuid) from public;
grant execute on function public.unlink_staff(uuid) to authenticated;
