-- Admins may claim a player spot even though their account is set up as a coach.
create or replace function public.claim_invite(p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
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
  if not v_admin and (
       exists (select 1 from public.players where coach_id = v_uid)
       or exists (select 1 from public.results where coach_id = v_uid)) then
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

  return json_build_object('player_id', v_player.id, 'player_name', v_player.name,
                           'team_name', v_coach.team_name, 'coach_id', v_inv.coach_id);
end;
$$;
