import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardPlus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  formatDate,
  formatSets,
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

/** One player's record and every match they played (no scouting notes). */
export function PlayerPage() {
  const { playerId = "" } = useParams();
  const { isPlayer, canManageTeam, player: me, ownerId } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [opponents, setOpponents] = useState<Map<string, Opponent>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: r }, { data: o }] = await Promise.all([
        supabase
          .from("players")
          .select("*")
          .eq("id", playerId)
          .eq("coach_id", ownerId!)
          .maybeSingle(),
        // Players read teammates' matches through the notes-free team view.
        supabase
          .from(isPlayer ? "team_match_results" : "results")
          .select("*")
          .eq("coach_id", ownerId!)
          .or(`player_id.eq.${playerId},player2_id.eq.${playerId}`)
          .order("played_on", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("opponents").select("*").eq("coach_id", ownerId!),
      ]);
      setPlayer((p as Player) ?? null);
      setResults((r as Result[]) ?? []);
      setOpponents(
        new Map(((o as Opponent[]) ?? []).map((x) => [x.id, x] as const)),
      );
      setLoading(false);
    }
    void load();
  }, [playerId, ownerId, isPlayer]);

  const stats = useMemo(() => {
    const tally = (list: Result[]) => {
      const w = list.filter((r) => r.outcome === "win").length;
      return { w, l: list.length - w };
    };
    return {
      all: tally(results),
      singles: tally(results.filter((r) => r.format !== "doubles")),
      doubles: tally(results.filter((r) => r.format === "doubles")),
    };
  }, [results]);

  const theirSide = (r: Result) => {
    const a = opponents.get(r.opponent_id)?.name ?? "Unknown";
    const b = r.opponent2_id ? opponents.get(r.opponent2_id)?.name : null;
    return b ? `${a} & ${b}` : a;
  };

  if (loading) return <p className="text-slate-500">Loading…</p>;

  if (!player) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold">Player not found</p>
        <Link to="/team" className="btn-secondary mt-4">
          <ArrowLeft size={16} /> Back to team
        </Link>
      </div>
    );
  }

  const isMe = me?.id === player.id;
  const total = stats.all.w + stats.all.l;
  const winRate = total ? Math.round((stats.all.w / total) * 100) : null;

  return (
    <div className="space-y-6">
      <Link
        to="/team"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Team
      </Link>

      {/* Header */}
      <section
        className="card flex flex-wrap items-center gap-4 p-5"
        data-reveal
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-court-100 text-lg font-bold text-court-800">
          {initials(player.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">
            {player.name}
            {isMe && (
              <span className="ml-2 align-middle text-sm font-medium text-court-700">
                You
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500">
            {total} match{total === 1 ? "" : "es"}
            {winRate !== null ? ` · ${winRate}% won` : ""}
          </p>
        </div>
        {(canManageTeam || isMe) && (
          <Link to={`/add?player=${player.id}`} className="btn-primary lift">
            <ClipboardPlus size={16} /> Add result
          </Link>
        )}
      </section>

      {/* Record */}
      <section
        className="grid grid-cols-3 gap-3"
        data-reveal
        style={{ ["--d" as string]: "90ms" }}
      >
        <Record label="Overall" {...stats.all} />
        <Record label="Singles" {...stats.singles} />
        <Record label="Doubles" {...stats.doubles} />
      </section>

      {/* Matches */}
      <section data-reveal style={{ ["--d" as string]: "180ms" }}>
        <h2 className="mb-2 text-base font-semibold">Matches</h2>
        {results.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            No matches logged yet.
          </div>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {results.map((r) => {
              const partner = partnerOf(r, player.id);
              return (
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
                          <span className="text-slate-400">vs</span>{" "}
                          <span className="font-semibold">{theirSide(r)}</span>
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {r.format === "doubles"
                            ? partner
                              ? `Doubles with ${partner} · `
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
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Record({ label, w, l }: { label: string; w: number; l: number }) {
  return (
    <div className="card p-4">
      <p className="text-lg font-bold">
        <span className="text-court-700">{w}W</span>
        <span className="text-slate-300"> · </span>
        <span className="text-red-600">{l}L</span>
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
