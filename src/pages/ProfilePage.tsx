import { useEffect, useState, type FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { SPORTS, type Player, type Sport } from "../lib/types";
import { useRosterAdmin } from "../lib/useRosterAdmin";
import {
  RosterLead,
  RosterRowActions,
  RosterStatus,
} from "../components/RosterRowActions";

export function ProfilePage() {
  const { isPlayer } = useAuth();
  return isPlayer ? <PlayerProfile /> : <CoachProfile />;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */
function PlayerProfile() {
  const { session, profile, player, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null })
      .eq("id", session!.user.id);
    setSaving(false);
    if (error) return setError(error.message);
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-8">
      <header data-reveal>
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="mt-1 text-slate-500">
          You&apos;re signed in as a player.
        </p>
      </header>

      <section
        className="card flex items-center gap-4 p-5"
        data-reveal
        style={{ ["--d" as string]: "90ms" }}
      >
        <span className="grid size-12 place-items-center rounded-full bg-court-100 text-base font-bold text-court-800">
          {initials(player?.name ?? profile?.full_name ?? "P")}
        </span>
        <div>
          <p className="font-semibold">{player?.name}</p>
          <p className="text-sm text-slate-500">
            Player on{" "}
            <span className="font-medium text-court-700">
              {profile?.team_name || "your team"}
            </span>
          </p>
        </div>
      </section>

      <section
        className="card p-5"
        data-reveal
        style={{ ["--d" as string]: "180ms" }}
      >
        <label className="label" htmlFor="playerName">
          Display name
        </label>
        <input
          id="playerName"
          className="input max-w-md"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
        />
        <p className="mt-3 text-sm text-slate-500">
          You can log results and notes for matches you played. Your coach
          manages the team and its players.
        </p>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary lift" onClick={save} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
        <button className="btn-ghost text-slate-500" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coach                                                               */
/* ------------------------------------------------------------------ */
function CoachProfile() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const userId = session!.user.id;

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [teamName, setTeamName] = useState(profile?.team_name ?? "");
  const [sport, setSport] = useState<Sport | null>(profile?.sport ?? null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayer, setNewPlayer] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roster = useRosterAdmin(setPlayers);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setTeamName(profile?.team_name ?? "");
    setSport(profile?.sport ?? null);
  }, [profile]);

  useEffect(() => {
    supabase
      .from("players")
      .select("*")
      .order("name")
      .then(({ data }) => setPlayers((data as Player[]) ?? []));
  }, []);

  async function addPlayer(e: FormEvent) {
    e.preventDefault();
    if (await roster.addPlayer(newPlayer)) setNewPlayer("");
  }

  async function saveProfile() {
    if (!sport) return setError("Pick the sport you coach first.");
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        team_name: teamName.trim() || null,
        sport,
        onboarded: true,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) return setError(error.message);
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const joined = players.filter((p) => p.user_id).length;

  return (
    <div className="space-y-8">
      <header data-reveal>
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="mt-1 text-slate-500">
          Manage your team, sport and players.
        </p>
      </header>

      {/* Coach & team */}
      <section
        className="card grid gap-4 p-5 sm:grid-cols-2"
        data-reveal
        style={{ ["--d" as string]: "90ms" }}
      >
        <div>
          <label className="label" htmlFor="coachName">
            Coach name
          </label>
          <input
            id="coachName"
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="label" htmlFor="teamName">
            Team name
          </label>
          <input
            id="teamName"
            className="input"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Westlake Varsity Tennis"
          />
        </div>
      </section>

      {/* Sport */}
      <section
        className="card p-5"
        data-reveal
        style={{ ["--d" as string]: "180ms" }}
      >
        <h2 className="text-base font-semibold">Sport you coach</h2>
        <p className="mb-4 text-sm text-slate-500">Pick the sport you coach.</p>
        <div className="grid max-w-44 grid-cols-1 gap-3">
          {SPORTS.map((s) => {
            const active = sport === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSport(s.id)}
                className={`lift relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-sm font-semibold transition ${
                  active
                    ? "border-court-600 bg-court-50 text-court-900"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {active && (
                  <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-court-600 text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <span className={`ball size-10 ${active ? "float" : ""}`} />
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-slate-400">Other sports coming soon.</p>
      </section>

      {/* Players */}
      <section
        className="card p-5"
        data-reveal
        style={{ ["--d" as string]: "270ms" }}
      >
        <h2 className="text-base font-semibold">Your players</h2>
        <p className="text-sm text-slate-500">
          {players.length === 0
            ? "No players yet. Add your first one below."
            : `${players.length} on the team · ${joined} joined with their own account`}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Invite a player to claim their spot. They can then log their own
          matches and notes.
        </p>

        <form onSubmit={addPlayer} className="mt-4 flex gap-2">
          <input
            className="input"
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            placeholder="Player name"
            aria-label="New player name"
          />
          <button
            type="submit"
            className="btn-primary shrink-0"
            disabled={roster.adding || !newPlayer.trim()}
          >
            <Plus size={16} strokeWidth={3} /> Add
          </button>
        </form>

        <ul className="mt-4 divide-y divide-slate-100">
          {players.map((p) => {
            const status = roster.statusOf(p);
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <RosterLead
                    player={p}
                    status={status}
                    onInvite={roster.openInvite}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      <RosterStatus status={status} />
                    </p>
                  </div>
                </div>
                <RosterRowActions
                  player={p}
                  status={status}
                  onUnlink={roster.askUnlink}
                  onRemove={roster.askRemove}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {(error || roster.error) && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error || roster.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn-primary lift"
          onClick={() => saveProfile()}
          disabled={saving}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
        <button className="btn-ghost text-slate-500" onClick={signOut}>
          Sign out
        </button>
      </div>

      {roster.dialogs}
    </div>
  );
}
