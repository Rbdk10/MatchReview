export type Sport = "tennis";

export const SPORTS: { id: Sport; label: string; emoji: string }[] = [
  { id: "tennis", label: "Tennis", emoji: "🎾" },
];

export interface Profile {
  id: string;
  full_name: string | null;
  team_name: string | null;
  school_id: number | null;
  sport: Sport | null;
  onboarded: boolean;
  role: Role;
  is_admin: boolean;
}

export type Role = "coach" | "player" | "staff";

export type StaffRole = "assistant_coach" | "team_manager" | "sid";

export const STAFF_ROLES: { id: StaffRole; label: string }[] = [
  { id: "assistant_coach", label: "Assistant Coach" },
  { id: "team_manager", label: "Team Manager" },
  { id: "sid", label: "SID" },
];

export function staffRoleLabel(role: StaffRole): string {
  return STAFF_ROLES.find((r) => r.id === role)?.label ?? role;
}

export interface Staff {
  id: string;
  coach_id: string;
  name: string;
  role: StaffRole;
  /** The signed-in account that claimed this staff spot, if any. */
  user_id: string | null;
  claimed_at: string | null;
  created_at: string;
}

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
  did_well_tags: string[] | null;
  struggled_tags: string[] | null;
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

/** Short label for a team/school, e.g. "Montana State University - Bozeman" -> "MSU". */
export function teamShortName(name?: string | null): string {
  const full = name?.trim();
  if (!full) return "My team";
  if (full.length <= 14) return full;
  return schoolAcronym(full);
}

/**
 * A school's acronym: "University of Delaware" → "UD", "University of San Diego" → "USD",
 * "Montana State University - Bozeman" → "MSU". One-word names ("Harvard", "MSU") stay as they are.
 */
export function schoolAcronym(name: string): string {
  const full = name.trim();
  const base = full.split(/\s+-\s+|\s*\(/)[0];
  const stop = new Set(["of", "the", "and", "at", "for", "in"]);
  const words = base.match(/[A-Za-z][A-Za-z'.]*/g) ?? [];
  if (words.length < 2) return full;
  const acronym = words
    .filter((w) => !stop.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase())
    .join("");
  return acronym.length >= 2 ? acronym : full;
}

/** In a doubles match, the name of the teammate who played alongside `playerId`. */
export function partnerOf(
  r: Pick<Result, "player_id" | "player_name" | "player2_id" | "player2_name">,
  playerId: string,
): string | null {
  if (!r.player2_name) return null;
  return r.player_id === playerId ? r.player2_name : r.player_name;
}

/**
 * Capitalise each part of a person's name: "john smith" → "John Smith", "MARY-JANE O'NEIL" → "Mary-Jane O'Neil".
 * A part typed in mixed case (e.g. "McDonald") keeps its inner capitals.
 */
export function formatPersonName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\s\-']+/g, (part) => {
      const rest =
        part.slice(1) === part.slice(1).toUpperCase() ||
        part.slice(1) === part.slice(1).toLowerCase()
          ? part.slice(1).toLowerCase()
          : part.slice(1);
      return part.charAt(0).toUpperCase() + rest;
    });
}
