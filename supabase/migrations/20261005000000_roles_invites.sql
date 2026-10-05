-- Roles: coach / player, claimable team spots, invite links, player-scoped access.

alter table public.profiles
  add column if not exists role text not null default 'coach' check (role in ('coach','player'));

alter table public.players
  add column if not exists user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists claimed_at timestamptz;

alter table public.results
  add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;
update public.results set created_by = coach_id where created_by is null;

-- One pending invite per team spot. Kept in its own table so teammates can never read tokens.
create table if not exists public.player_invites (
  player_id uuid primary key references public.players(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.player_invites enable row level security;

create policy "invites: coach manages own" on public.player_invites
  for all using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.user_id is null
    )
  );

-- Helpers (security definer so policies don't recurse into players RLS)
create or replace function public.my_player_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.players where user_id = auth.uid() limit 1
$$;

create or replace function public.my_coach_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coach_id from public.players where user_id = auth.uid() limit 1
$$;

-- Players (the role) can see their team, the team's opponents, and only their own matches.
create policy "players: teammates read" on public.players
  for select using (coach_id = public.my_coach_id());

create policy "opponents: team read" on public.opponents
  for select using (coach_id = public.my_coach_id());

create policy "opponents: team add" on public.opponents
  for insert with check (coach_id = public.my_coach_id());

create policy "results: player reads own matches" on public.results
  for select using (player_id = public.my_player_id() or player2_id = public.my_player_id());

create policy "results: player adds own matches" on public.results
  for insert with check (
    coach_id = public.my_coach_id()
    and created_by = auth.uid()
    and (player_id = public.my_player_id() or player2_id = public.my_player_id())
  );

-- Only the claim/unlink functions may set who owns a team spot.
revoke insert, update on public.players from authenticated, anon;
grant insert (coach_id, name) on public.players to authenticated;
grant update (name) on public.players to authenticated;

-- Public preview of an invite (so the join page can say who invited you before sign-in)
create or replace function public.invite_preview(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'player_name', p.name,
    'team_name', pr.team_name,
    'coach_name', pr.full_name
  )
  from public.player_invites i
  join public.players p on p.id = i.player_id
  join public.profiles pr on pr.id = i.coach_id
  where i.token = p_token and p.user_id is null
$$;

create or replace function public.claim_invite(p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.player_invites;
  v_player public.players;
  v_coach public.profiles;
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;

  select * into v_inv from public.player_invites where token = p_token;
  if not found then raise exception 'This invite link is invalid or has already been used.'; end if;
  if v_inv.coach_id = v_uid then raise exception 'You cannot claim a spot on your own team.'; end if;
  if exists (select 1 from public.players where user_id = v_uid) then
    raise exception 'This account is already on a team.';
  end if;
  if exists (select 1 from public.players where coach_id = v_uid)
     or exists (select 1 from public.results where coach_id = v_uid) then
    raise exception 'This account already coaches a team. Use a different Google account to join as a player.';
  end if;

  select * into v_player from public.players where id = v_inv.player_id for update;
  if v_player.user_id is not null then raise exception 'This spot has already been claimed.'; end if;
  select * into v_coach from public.profiles where id = v_inv.coach_id;

  update public.players set user_id = v_uid, claimed_at = now() where id = v_player.id;

  insert into public.profiles (id, full_name, role, onboarded, sport, team_name)
  values (v_uid, v_player.name, 'player', true, v_coach.sport, v_coach.team_name)
  on conflict (id) do update set
    role = 'player',
    onboarded = true,
    sport = excluded.sport,
    team_name = excluded.team_name,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);

  delete from public.player_invites where player_id = v_player.id;

  return json_build_object('player_id', v_player.id, 'player_name', v_player.name, 'team_name', v_coach.team_name);
end;
$$;

-- Coach frees a claimed spot again (the row and its results stay).
create or replace function public.unlink_player(p_player_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_old uuid;
begin
  select user_id into v_old from public.players where id = p_player_id and coach_id = auth.uid();
  if not found then raise exception 'Player not found.'; end if;
  update public.players set user_id = null, claimed_at = null where id = p_player_id;
  if v_old is not null then
    update public.profiles set role = 'coach', onboarded = false, team_name = null where id = v_old;
  end if;
end;
$$;

revoke execute on function public.claim_invite(uuid), public.unlink_player(uuid), public.invite_preview(uuid) from public;
grant execute on function public.claim_invite(uuid), public.unlink_player(uuid) to authenticated;
grant execute on function public.invite_preview(uuid) to anon, authenticated;
