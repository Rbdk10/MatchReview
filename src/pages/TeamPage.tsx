import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardPlus, School, Settings, UserPlus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { CountUp } from "../components/CountUp";
import { useRosterAdmin } from "../lib/useRosterAdmin";
import { StaffSection } from "../components/StaffSection";
import {
  RosterLead,
  RosterRowActions,
  RosterStatus,
} from "../components/RosterRowActions";
import {
  schoolAcronym,
  formatDate,
  teamShortName,
  formatSets,
  ourSide,
  partnerOf,
  type Opponent,
  type Player,
  type Result,
} from "../lib/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TeamPage() {
  const { profile, isPlayer, canManageTeam, player: me, ownerId } = useAuth();
  const mine = me ? `player_id.eq.${me.id},player2_id.eq.${me.id}` : null;
  const [players, setPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [opponents, setOpponents] = useState<Map<string, Opponent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newPlayer, setNewPlayer] = useState("");
  const roster = useRosterAdmin(setPlayers);

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: r }, { data: o }] = await Promise.all([
        supabase
          .from("players")
          .select("*")
          .eq("coach_id", ownerId!)
          .order("name"),
        supabase
          .from("results")
          .select("*")
          .eq("coach_id", ownerId!)
          .or(mine ?? "id.not.is.null")
          .order("played_on", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("opponents").select("*").eq("coach_id", ownerId!),
      ]);
      setPlayers((p as Player[]) ?? []);
      setResults((r as Result[]) ?? []);
      setOpponents(
        new Map(((o as Opponent[]) ?? []).map((x) => [x.id, x] as const)),
      );
      setLoading(false);
    }
    void load();
  }, []);

  const teamName = profile?.team_name?.trim() || "Your team";
  const wins = results.filter((r) => r.outcome === "win").length;
  const losses = results.length - wins;
  const winRate = results.length
    ? Math.round((wins / results.length) * 100)
    : null;

  // Record per player (singles and doubles both count for everyone on court).
  const records = useMemo(() => {
    const map = new Map<
      string,
      { w: number; l: number; last: string | null }
    >();
    for (const r of results) {
      for (const id of [r.player_id, r.player2_id]) {
        if (!id) continue;
        const rec = map.get(id) ?? { w: 0, l: 0, last: null };
        if (r.outcome === "win") rec.w++;
        else rec.l++;
        if (!rec.last || r.played_on > rec.last) rec.last = r.played_on;
        map.set(id, rec);
      }
    }
    return map;
  }, [results]);

  const theirSide = (r: Result) => {
    const a = opponents.get(r.opponent_id)?.name ?? "Unknown";
    const b = r.opponent2_id ? opponents.get(r.opponent2_id)?.name : null;
    return b ? `${a} & ${b}` : a;
  };

  // Schools the team has faced, by number of matches.
  const schools = useMemo(() => {
    const map = new Map<string, { w: number; l: number }>();
    for (const r of results) {
      const school = opponents.get(r.opponent_id)?.school?.trim();
      if (!school) continue;
      const rec = map.get(school) ?? { w: 0, l: 0 };
      if (r.outcome === "win") rec.w++;
      else rec.l++;
      map.set(school, rec);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].w + b[1].l - (a[1].w + a[1].l))
      .slice(0, 6);
  }, [results, opponents]);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="hero-glow rounded-3xl" data-reveal>
        <section className="relative overflow-hidden rounded-3xl bg-court-800 p-6 text-white shadow-lg md:p-8">
          <div className="aurora aurora-sm opacity-70" aria-hidden="true" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-ball text-xl font-extrabold text-court-950 shadow-md">
                {teamShortName(teamName).slice(0, 4)}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-court-200">
                  <School size={14} />{" "}
                  <span className="capitalize">
                    {profile?.sport ?? "tennis"}
                  </span>
                </p>
                <h1 className="text-2xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-3xl md:text-4xl">
                  {teamName}
                </h1>
                <p className="mt-1 text-court-100/80">
                  {players.length} player{players.length === 1 ? "" : "s"}
                  {canManageTeam
                    ? ` · coached by ${profile?.full_name || "you"}`
                    : ""}
                </p>
              </div>
            </div>
            {canManageTeam && (
              <Link
                to="/profile"
                className="btn bg-white/10 text-white hover:bg-white/20"
              >
                <Settings size={16} /> Manage team
              </Link>
            )}
          </div>
        </section>
      </div>

      {/* Record */}
      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        data-reveal
        style={{ ["--d" as string]: "90ms" }}
      >
        <Stat
          label={isPlayer ? "Your matches" : "Matches"}
          value={loading ? "–" : <CountUp value={results.length} />}
        />
        <Stat
          label="Wins"
          value={loading ? "–" : <CountUp value={wins} />}
          tone="win"
        />
        <Stat
          label="Losses"
          value={loading ? "–" : <CountUp value={losses} />}
          tone="loss"
        />
        <Stat
          label="Win rate"
          value={
            loading || winRate === null ? (
              "–"
            ) : (
              <CountUp value={winRate} suffix="%" />
            )
          }
        />
      </section>

      {/* Roster */}
      <section data-reveal style={{ ["--d" as string]: "180ms" }}>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Roster</h2>
            {canManageTeam && (
              <p className="text-sm text-slate-500">
                Add players, then invite each one to claim their spot and log
                their own matches.
              </p>
            )}
          </div>
          {isPlayer && (
            <span className="text-xs text-slate-400">
              Records show for your own matches
            </span>
          )}
        </div>

        {canManageTeam && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await roster.addPlayer(newPlayer)) setNewPlayer("");
            }}
            className="card mb-3 flex gap-2 p-3"
          >
            <input
              className="input min-w-0"
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
              placeholder="Add a player by name"
              aria-label="New player name"
            />
            <button
              type="submit"
              className="btn-primary shrink-0"
              disabled={roster.adding || !newPlayer.trim()}
            >
              <UserPlus size={16} /> Add player
            </button>
          </form>
        )}

        {roster.error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {roster.error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : players.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            {!canManageTeam
              ? "No players on the roster yet."
              : "No players yet. Add your first one above."}
          </div>
        ) : (
          <ul className={`grid gap-3 ${isPlayer ? "sm:grid-cols-2" : ""}`}>
            {players.map((p) => {
              const rec = records.get(p.id);
              const isMe = me?.id === p.id;
              const showRecord = !isPlayer || isMe;
              const status = roster.statusOf(p);
              return (
                <li
                  key={p.id}
                  className={`card flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-4 ${isMe ? "border-court-300" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {!canManageTeam ? (
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-court-100 text-sm font-bold text-court-800">
                        {initials(p.name)}
                      </span>
                    ) : (
                      <RosterLead
                        player={p}
                        status={status}
                        onInvite={roster.openInvite}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {p.name}
                        {isMe && (
                          <span className="ml-2 text-xs font-medium text-court-700">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {canManageTeam && (
                          <>
                            <RosterStatus status={status} /> ·{" "}
                          </>
                        )}
                        {showRecord
                          ? rec?.last
                            ? `last played ${formatDate(rec.last)}`
                            : "no matches yet"
                          : p.user_id
                            ? "teammate · joined"
                            : "teammate"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {showRecord && (
                      <p className="text-sm font-semibold">
                        <span className="text-court-700">{rec?.w ?? 0}W</span>{" "}
                        <span className="text-slate-300">·</span>{" "}
                        <span className="text-red-600">{rec?.l ?? 0}L</span>
                      </p>
                    )}
                    {canManageTeam && (
                      <RosterRowActions
                        player={p}
                        status={status}
                        onUnlink={roster.askUnlink}
                        onRemove={roster.askRemove}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <StaffSection />

      {/* Schools faced */}
      {schools.length > 0 && (
        <section data-reveal style={{ ["--d" as string]: "240ms" }}>
          <h2 className="mb-2 text-base font-semibold">Schools faced</h2>
          <div className="flex flex-wrap gap-2">
            {schools.map(([name, rec]) => (
              <span
                key={name}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm shadow-sm"
                title={name}
              >
                <span className="font-medium">{schoolAcronym(name)}</span>{" "}
                <span className="font-semibold text-court-700">{rec.w}W</span>
                <span className="text-slate-300"> · </span>
                <span className="font-semibold text-red-600">{rec.l}L</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Recent */}
      <section data-reveal style={{ ["--d" as string]: "300ms" }}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {isPlayer ? "Your recent matches" : "Recent team matches"}
          </h2>
          <Link
            to="/add"
            className="flex items-center gap-1 text-sm font-medium text-court-700"
          >
            <ClipboardPlus size={14} /> Add result
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : results.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            No matches logged yet.
          </div>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {results.slice(0, 10).map((r) => (
              <li key={r.id}>
                <Link
                  to={`/opponents?open=${r.opponent_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-court-50/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                        r.outcome === "win"
                          ? "bg-court-100 text-court-800"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {r.outcome}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {!isPlayer && (
                          <>
                            <span className="font-semibold">
                              {ourSide(r)}
                            </span>{" "}
                          </>
                        )}
                        <span className="text-slate-400">vs</span>{" "}
                        <span className="font-semibold">{theirSide(r)}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {r.format === "doubles"
                          ? isPlayer && me && partnerOf(r, me.id)
                            ? `Doubles with ${partnerOf(r, me.id)} · `
                            : "Doubles · "
                          : ""}
                        {formatDate(r.played_on)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold">
                    {formatSets(r.sets)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {roster.dialogs}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "win" | "loss";
}) {
  return (
    <div className="card lift p-4">
      <p
        className={`text-2xl font-bold ${tone === "win" ? "text-court-700" : tone === "loss" ? "text-red-600" : ""}`}
      >
        {value}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
