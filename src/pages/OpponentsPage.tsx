import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  ClipboardPlus,
  Search,
  ThumbsUp,
  TrendingDown,
  UserPlus,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Modal } from "../components/Modal";
import { tallyTags } from "../lib/shotTags";
import { SchoolPicker, type School } from "../components/SchoolPicker";
import {
  formatDate,
  formatSets,
  ourSide,
  type Opponent,
  type Result,
} from "../lib/types";

interface OpponentRow extends Opponent {
  results: Result[];
}

export function OpponentsPage() {
  const [rows, setRows] = useState<OpponentRow[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const openedRef = useRef<HTMLLIElement>(null);
  const { ownerId, player: me } = useAuth();
  const mine = me ? `player_id.eq.${me.id},player2_id.eq.${me.id}` : null;
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSchool, setNewSchool] = useState<School | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function openAdd() {
    setNewName("");
    setNewSchool(null);
    setAddError(null);
    setAdding(true);
  }

  async function addOpponent(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !ownerId) return;
    setAddBusy(true);
    setAddError(null);
    const { data, error } = await supabase
      .from("opponents")
      .insert({
        coach_id: ownerId,
        name,
        school_id: newSchool?.id ?? null,
      })
      .select("*")
      .single();
    setAddBusy(false);
    if (error) {
      setAddError(
        error.code === "23505"
          ? "You already have an opponent with that name."
          : error.message,
      );
      return;
    }
    const created = data as Opponent;
    setRows((prev) =>
      [...prev, { ...created, results: [] }].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    setAdding(false);
    setQuery("");
    setOpenId(created.id);
    setParams({ open: created.id }, { replace: true });
  }

  useEffect(() => {
    async function load() {
      const [{ data: o }, { data: r }] = await Promise.all([
        supabase
          .from("opponents")
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
      ]);
      const results = (r as Result[]) ?? [];
      const byOpp = new Map<string, Result[]>();
      for (const res of results) {
        for (const id of [res.opponent_id, res.opponent2_id]) {
          if (!id) continue;
          const list = byOpp.get(id) ?? [];
          list.push(res);
          byOpp.set(id, list);
        }
      }
      const nameById = new Map(
        ((o as Opponent[]) ?? []).map((x) => [x.id, x.name] as const),
      );
      setNames(nameById);
      setRows(
        ((o as Opponent[]) ?? []).map((opp) => ({
          ...opp,
          results: byOpp.get(opp.id) ?? [],
        })),
      );
      setLoading(false);
    }
    void load();
  }, []);

  useEffect(() => {
    if (!loading && openId && openedRef.current) {
      openedRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.school ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  function toggle(id: string) {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) setParams({ open: next }, { replace: true });
    else setParams({}, { replace: true });
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-5">
      <header
        className="flex flex-wrap items-end justify-between gap-3"
        data-reveal
      >
        <div>
          <h1 className="text-2xl font-bold">Opponents</h1>
          <p className="mt-1 text-slate-500">
            {rows.length === 0
              ? "No opponents yet."
              : `${rows.length} registered · tap one to see your notes`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openAdd}
            className="btn-secondary lift"
          >
            <UserPlus size={16} /> Add opponent
          </button>
          <Link to="/add" className="btn-primary lift">
            <ClipboardPlus size={16} /> Add result
          </Link>
        </div>
      </header>

      {rows.length > 0 && (
        <div
          className="relative"
          data-reveal
          style={{ ["--d" as string]: "80ms" }}
        >
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-3 text-slate-400"
          />
          <input
            className="input pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or school"
            aria-label="Search opponents"
          />
        </div>
      )}

      {rows.length === 0 && (
        <div className="card p-8 text-center" data-reveal>
          <span className="ball float mx-auto size-14" />
          <h2 className="mt-3 text-lg font-semibold">
            Your scouting book is empty
          </h2>
          <p className="mt-1 text-slate-500">
            Register an opponent now, or add one on the fly when you log a
            result.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={openAdd}
              className="btn-primary lift"
            >
              <UserPlus size={16} /> Add opponent
            </button>
            <Link to="/add" className="btn-secondary lift">
              <ClipboardPlus size={16} /> Add a result
            </Link>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {filtered.map((opp, idx) => {
          const wins = opp.results.filter((r) => r.outcome === "win").length;
          const losses = opp.results.length - wins;
          const open = openId === opp.id;
          const didWell = opp.results.filter((r) => r.did_well);
          const struggled = opp.results.filter((r) => r.struggled_with);
          const didWellTags = tallyTags(
            opp.results.map((r) => r.did_well_tags),
          );
          const struggledTags = tallyTags(
            opp.results.map((r) => r.struggled_tags),
          );
          return (
            <li
              key={opp.id}
              className={`card lift scroll-mt-20 overflow-hidden md:scroll-mt-4 ${open ? "border-court-300 shadow-md" : ""}`}
              ref={open ? openedRef : undefined}
              data-reveal
              style={{ ["--d" as string]: `${Math.min(idx, 8) * 60 + 120}ms` }}
            >
              <button
                type="button"
                onClick={() => toggle(opp.id)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"
                aria-expanded={open}
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{opp.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {opp.school || "No school recorded"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      <span className="text-court-700">{wins}W</span>{" "}
                      <span className="text-slate-300">·</span>{" "}
                      <span className="text-red-600">{losses}L</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {opp.results.length === 0
                        ? "no matches"
                        : `last ${formatDate(opp.results[0].played_on)}`}
                    </p>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-slate-400 transition ${open ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {open && (
                <div className="expand-in border-t border-slate-100 bg-slate-50/60 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-500">
                      {opp.results.length} match
                      {opp.results.length === 1 ? "" : "es"} against your team
                    </p>
                    <Link
                      to={`/add?opponent=${opp.id}`}
                      className="btn-secondary lift px-3 py-1.5 text-court-700"
                    >
                      <ClipboardPlus size={16} /> Add result vs{" "}
                      {opp.name.split(" ")[0]}
                    </Link>
                  </div>

                  {(didWell.length > 0 ||
                    struggled.length > 0 ||
                    didWellTags.length > 0 ||
                    struggledTags.length > 0) && (
                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-court-200 bg-court-50 p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-court-800">
                          <ThumbsUp size={14} /> {opp.name.split(" ")[0]} does
                          well
                        </p>
                        <TagTally tags={didWellTags} tone="good" />
                        {didWell.length === 0 && didWellTags.length === 0 ? (
                          <p className="text-sm text-court-800/60">
                            Nothing noted yet.
                          </p>
                        ) : (
                          <ul className="space-y-1.5 text-sm text-court-950">
                            {didWell.map((r) => (
                              <li key={r.id}>
                                {r.did_well}
                                <span className="ml-1 text-xs text-court-700/70">
                                  · {formatDate(r.played_on)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
                          <TrendingDown size={14} /> {opp.name.split(" ")[0]}{" "}
                          struggles with
                        </p>
                        <TagTally tags={struggledTags} tone="bad" />
                        {struggled.length === 0 &&
                        struggledTags.length === 0 ? (
                          <p className="text-sm text-amber-800/60">
                            Nothing noted yet.
                          </p>
                        ) : (
                          <ul className="space-y-1.5 text-sm text-amber-950">
                            {struggled.map((r) => (
                              <li key={r.id}>
                                {r.struggled_with}
                                <span className="ml-1 text-xs text-amber-700/70">
                                  · {formatDate(r.played_on)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  <ul className="space-y-2">
                    {opp.results.map((r) => (
                      <li
                        key={r.id}
                        className="lift rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                                r.outcome === "win"
                                  ? "bg-court-100 text-court-800"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {r.outcome}
                            </span>
                            {r.format === "doubles" && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600">
                                Doubles
                              </span>
                            )}
                            <span className="text-sm">
                              <span className="font-semibold">
                                {ourSide(r)}
                              </span>{" "}
                              <span className="text-slate-400">vs</span>{" "}
                              {theirSide(r, names)}
                            </span>
                          </div>
                          <div className="text-right text-sm">
                            <span className="font-mono font-semibold tracking-wide">
                              {formatSets(r.sets)}
                            </span>
                            <span className="ml-2 text-xs text-slate-400">
                              {formatDate(r.played_on)}
                            </span>
                          </div>
                        </div>
                        {r.notes && (
                          <p className="mt-2 text-sm text-slate-600">
                            {r.notes}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {rows.length > 0 && filtered.length === 0 && (
        <p className="text-center text-sm text-slate-500">
          No opponents match “{query}”.
        </p>
      )}

      <Modal
        open={adding}
        title="Add opponent"
        onClose={() => setAdding(false)}
      >
        <form onSubmit={addOpponent} className="space-y-4">
          <div>
            <label className="label" htmlFor="oppName">
              Name
            </label>
            <input
              id="oppName"
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Opponent's name"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="oppSchool">
              School{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <SchoolPicker
              id="oppSchool"
              value={newSchool}
              onChange={setNewSchool}
              placeholder="Search US schools"
              optional
            />
          </div>
          {addError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {addError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAdding(false)}
              disabled={addBusy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={addBusy || !newName.trim()}
            >
              {addBusy ? "Saving…" : "Add opponent"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function theirSide(r: Result, names: Map<string, string>): string {
  const a = names.get(r.opponent_id) ?? "Unknown";
  const b = r.opponent2_id ? names.get(r.opponent2_id) : null;
  return b ? `${a} & ${b}` : a;
}

/** Tag chips with how many matches each was noted in, most common first. */
function TagTally({
  tags,
  tone,
}: {
  tags: { tag: string; count: number }[];
  tone: "good" | "bad";
}) {
  if (tags.length === 0) return null;
  const cls =
    tone === "good"
      ? "border-court-300 bg-white text-court-900"
      : "border-amber-300 bg-white text-amber-900";
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {tags.map(({ tag, count }) => (
        <span
          key={tag}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
        >
          {tag}
          {count > 1 && <span className="ml-1 opacity-60">×{count}</span>}
        </span>
      ))}
    </div>
  );
}
