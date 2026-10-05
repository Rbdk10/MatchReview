import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Users, Trophy, ClipboardList } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { CountUp } from "../components/CountUp";
import {
  formatDate,
  formatSets,
  ourSide,
  type Player,
  type ResultWithOpponent,
} from "../lib/types";

export function HomePage() {
  const { profile, isPlayer } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [recent, setRecent] = useState<ResultWithOpponent[]>([]);
  const [counts, setCounts] = useState({ results: 0, wins: 0, opponents: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { data: p },
        { data: r },
        { count: oppCount },
        { count: resCount },
        { count: winCount },
      ] = await Promise.all([
        supabase.from("players").select("*").order("name"),
        supabase
          .from("results")
          .select(
            "*, opponent:opponents!results_opponent_id_fkey(id, name, school), opponent2:opponents!results_opponent2_id_fkey(id, name, school)",
          )
          .order("played_on", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("opponents").select("*", { count: "exact", head: true }),
        supabase.from("results").select("*", { count: "exact", head: true }),
        supabase
          .from("results")
          .select("*", { count: "exact", head: true })
          .eq("outcome", "win"),
      ]);
      setPlayers((p as Player[]) ?? []);
      setRecent((r as ResultWithOpponent[]) ?? []);
      setCounts({
        results: resCount ?? 0,
        wins: winCount ?? 0,
        opponents: oppCount ?? 0,
      });
      setLoading(false);
    }
    void load();
  }, []);

  const firstName = (profile?.full_name ?? "").split(" ")[0] || "Coach";
  const winRate = counts.results
    ? Math.round((counts.wins / counts.results) * 100)
    : null;

  return (
    <div className="space-y-6">
      <header data-reveal>
        <h1 className="text-2xl font-bold">Hi {firstName} 👋</h1>
        <p className="mt-1 text-slate-500">
          {profile?.team_name ? (
            <span className="font-medium text-court-700">
              {profile.team_name}
            </span>
          ) : null}
          {profile?.team_name ? " · " : ""}What happened on court today?
        </p>
      </header>

      {/* Hero CTA */}
      <div
        className="hero-glow rounded-3xl"
        data-reveal
        style={{ ["--d" as string]: "80ms" }}
      >
        <Link
          to="/add"
          className="lift group relative block overflow-hidden rounded-3xl bg-court-800 p-6 text-white shadow-lg transition hover:bg-court-700 md:p-8"
        >
          <div className="aurora aurora-sm opacity-70" aria-hidden="true" />
          <div
            className="sheen absolute inset-0 rounded-3xl"
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-court-200">
                Tennis
              </p>
              <p className="mt-1 text-2xl font-bold md:text-3xl">
                Add a match result
              </p>
              <p className="mt-1 text-court-100/80">
                Score, opponent and scouting notes in under a minute.
              </p>
            </div>
            <span className="float grid size-14 shrink-0 place-items-center rounded-full bg-ball text-court-950 shadow-md transition group-hover:scale-110 group-hover:rotate-90 md:size-16">
              <Plus size={30} strokeWidth={3} />
            </span>
          </div>
        </Link>
      </div>

      {/* Quick add per player */}
      {players.length > 0 && !isPlayer && (
        <section data-reveal style={{ ["--d" as string]: "160ms" }}>
          <p className="mb-2 text-sm font-medium text-slate-600">
            Quick add for a player
          </p>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <Link
                key={p.id}
                to={`/add?player=${p.id}`}
                className="lift rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium shadow-sm hover:border-court-500 hover:text-court-800"
              >
                + {p.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {!loading && players.length === 0 && !isPlayer && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add your players first so you can log who played.{" "}
          <Link to="/profile" className="font-semibold underline">
            Go to profile
          </Link>
        </div>
      )}

      {/* Stats */}
      <section
        className="grid grid-cols-3 gap-3"
        data-reveal
        style={{ ["--d" as string]: "240ms" }}
      >
        <Stat
          icon={ClipboardList}
          label="Results"
          value={loading ? "–" : <CountUp value={counts.results} />}
        />
        <Stat
          icon={Users}
          label="Opponents"
          value={loading ? "–" : <CountUp value={counts.opponents} />}
          to="/opponents"
        />
        <Stat
          icon={Trophy}
          label="Win rate"
          value={
            loading ? (
              "–"
            ) : winRate === null ? (
              "–"
            ) : (
              <CountUp value={winRate} suffix="%" />
            )
          }
        />
      </section>

      {/* Recent */}
      <section data-reveal style={{ ["--d" as string]: "320ms" }}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent results</h2>
          <Link
            to="/opponents"
            className="flex items-center gap-1 text-sm font-medium text-court-700"
          >
            All opponents <ArrowRight size={14} />
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : recent.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            No results yet.{" "}
            <Link to="/add" className="font-semibold text-court-700">
              Log the first one
            </Link>
            .
          </div>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/opponents?open=${r.opponent_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-court-50/60 hover:pl-5"
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
                        <span className="font-semibold">{ourSide(r)}</span>{" "}
                        <span className="text-slate-400">vs</span>{" "}
                        <span className="font-semibold">
                          {r.opponent?.name ?? "Unknown"}
                          {r.opponent2 ? ` & ${r.opponent2.name}` : ""}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {r.format === "doubles" ? "Doubles · " : ""}
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
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof Users;
  label: string;
  value: React.ReactNode;
  to?: string;
}) {
  const inner = (
    <>
      <Icon size={18} className="text-court-600" />
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </>
  );
  const cls = "card lift p-4";
  return to ? (
    <Link to={to} className={`${cls} hover:border-court-300`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
