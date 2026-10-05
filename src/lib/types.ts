export type Sport = "tennis";

export const SPORTS: { id: Sport; label: string; emoji: string }[] = [
  { id: "tennis", label: "Tennis", emoji: "🎾" },
];

export interface Profile {
  id: string;
  full_name: string | null;
  team_name: string | null;
  sport: Sport | null;
  onboarded: boolean;
  role: Role;
}

export type Role = "coach" | "player";

export interface Player {
  id: string;
  coach_id: string;
  name: string;
  created_at: string;
  /** The signed-in account that claimed this team spot, if any. */
  user_id: string | null;
  claimed_at: string | null;
}

export interface Opponent {
  id: string;
  coach_id: string;
  name: string;
  school: string | null;
  created_at: string;
}

export interface SetScore {
  us: number | null;
  them: number | null;
}

export type Outcome = "win" | "loss";
export type MatchFormat = "singles" | "doubles";

export interface Result {
  id: string;
  coach_id: string;
  opponent_id: string;
  player_id: string | null;
  player_name: string;
  format: MatchFormat;
  player2_id: string | null;
  player2_name: string | null;
  opponent2_id: string | null;
  sport: Sport;
  played_on: string;
  outcome: Outcome;
  sets: SetScore[];
  did_well: string | null;
  struggled_with: string | null;
  notes: string | null;
  created_at: string;
}

export interface ResultWithOpponent extends Result {
  opponent: Pick<Opponent, "id" | "name" | "school"> | null;
  opponent2: Pick<Opponent, "id" | "name" | "school"> | null;
}

/** "Alex Rivera & Jordan Lee" for doubles, "Alex Rivera" for singles. */
export function ourSide(
  r: Pick<Result, "player_name" | "player2_name">,
): string {
  return r.player2_name
    ? `${r.player_name} & ${r.player2_name}`
    : r.player_name;
}

export function formatSets(sets: SetScore[]): string {
  return sets
    .filter((s) => s.us !== null && s.them !== null)
    .map((s) => `${s.us}–${s.them}`)
    .join("  ");
}

export function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
