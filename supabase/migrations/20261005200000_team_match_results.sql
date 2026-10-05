-- Players can see every match their team played (scores, who, outcome) but not the
-- scouting notes on teammates' matches. Row security can't hide columns, so this view
-- exposes only the non-note columns, scoped to the viewer's own team.
create or replace view public.team_match_results as
select
  r.id, r.coach_id, r.opponent_id, r.opponent2_id,
  r.player_id, r.player_name, r.player2_id, r.player2_name,
  r.format, r.sport, r.played_on, r.outcome, r.sets, r.created_at
from public.results r
where r.coach_id = public.my_coach_id()
   or r.coach_id = auth.uid()
   or public.is_admin();

revoke all on public.team_match_results from anon, public;
grant select on public.team_match_results to authenticated;
