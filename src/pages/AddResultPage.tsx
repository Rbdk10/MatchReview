import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Plus, Trophy, User, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ScoutingCard } from "../components/ShotTagPicker";
import type {
  MatchFormat,
  Opponent,
  Outcome,
  Player,
  SetScore,
} from "../lib/types";
import {
  OpponentPicker,
  type OpponentChoice,
} from "../components/OpponentPicker";

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A set as typed. A match tiebreak (to 10) is the only score with two digits. */
type SetRow = SetScore & { tiebreak?: boolean };
const emptySet = (tiebreak = false): SetRow =>
  tiebreak ? { us: null, them: null, tiebreak } : { us: null, them: null };
const defaultSets = (format: MatchFormat) =>
  format === "doubles" ? [emptySet()] : [emptySet(), emptySet()];

export function AddResultPage() {
  const { ownerId, isPlayer, canManageTeam, player: me } = useAuth();
  // Results and new opponents always belong to the team (the coach's id).
  const userId = ownerId!;
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [players, setPlayers] = useState<Player[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [format, setFormat] = useState<MatchFormat>("singles");
  const [opp1, setOpp1] = useState<OpponentChoice | null>(null);
  const [opp2, setOpp2] = useState<OpponentChoice | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [playedOn, setPlayedOn] = useState(today());
  const [sets, setSets] = useState<SetRow[]>(defaultSets("singles"));
  // Adding the third set asks whether it was a full set or a match tiebreak.
  const [askThirdSet, setAskThirdSet] = useState(false);
  const [outcomeOverride, setOutcomeOverride] = useState<Outcome | null>(null);
  const [didWellTags, setDidWellTags] = useState<string[]>([]);
  const [struggledTags, setStruggledTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; label: string } | null>(
    null,
  );

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: o }] = await Promise.all([
        supabase
          .from("players")
          .select("*")
          .eq("coach_id", userId)
          .order("name"),
        supabase
          .from("opponents")
          .select("*")
          .eq("coach_id", userId)
          .order("name"),
      ]);
      const ps = (p as Player[]) ?? [];
      const os = (o as Opponent[]) ?? [];
      setPlayers(ps);
      setOpponents(os);
      const preP = params.get("player");
      // A player always logs their own match; a coach picks who played.
      if (isPlayer && me) setPlayerId(me.id);
      else if (preP && ps.some((x) => x.id === preP)) setPlayerId(preP);
      else if (ps.length === 1) setPlayerId(ps[0].id);
      const preO = params.get("opponent");
      const found = preO ? os.find((x) => x.id === preO) : undefined;
      if (found) setOpp1({ kind: "existing", opponent: found });
      if (params.get("format") === "doubles") changeFormat("doubles");
      setLoaded(true);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function changeFormat(next: MatchFormat) {
    setFormat(next);
    // Only reset the score grid if nothing has been typed yet.
    setSets((prev) =>
      prev.every((s) => s.us === null && s.them === null)
        ? defaultSets(next)
        : prev,
    );
    if (next === "singles") {
      setOpp2(null);
      setPlayer2Id("");
    }
  }

  const completeSets = sets.filter((s) => s.us !== null && s.them !== null);
  const usSets = completeSets.filter((s) => (s.us ?? 0) > (s.them ?? 0)).length;
  const themSets = completeSets.filter(
    (s) => (s.them ?? 0) > (s.us ?? 0),
  ).length;
  const autoOutcome: Outcome | null =
    completeSets.length === 0
      ? null
      : usSets > themSets
        ? "win"
        : usSets < themSets
          ? "loss"
          : null;
  const outcome: Outcome | null = outcomeOverride ?? autoOutcome;
  const doubles = format === "doubles";

  // Name the entered opponent(s) in the note labels instead of "they".
  const choiceName = (c: OpponentChoice | null) =>
    (c?.kind === "existing" ? c.opponent.name : (c?.name ?? ""))
      .trim()
      .split(/\s+/)[0];
  const oppNames = (doubles ? [opp1, opp2] : [opp1])
    .map(choiceName)
    .filter(Boolean);
  const subject =
    oppNames.length > 0
      ? oppNames.join(" & ")
      : doubles
        ? "the pair"
        : "the opponent";

  function updateSet(i: number, key: "us" | "them", raw: string) {
    const tiebreak = !!sets[i]?.tiebreak;
    const digits = raw.replace(/\D/g, "");
    // A normal set is one digit: keep the latest one typed. A tiebreak allows two.
    const kept = tiebreak ? digits.slice(0, 2) : digits.slice(-1);
    const v = kept === "" ? null : parseInt(kept, 10);
    setSets((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [key]: v } : s)),
    );
    // Jump on once the box is full: your side → their side → next set.
    if (kept.length === (tiebreak ? 2 : 1)) {
      const next =
        key === "us"
          ? `set-${i}-them`
          : i + 1 < sets.length
            ? `set-${i + 1}-us`
            : null;
      if (next)
        requestAnimationFrame(() => document.getElementById(next)?.focus());
    }
  }

  function addSet(tiebreak = false) {
    const i = sets.length;
    setSets((p) => [...p, emptySet(tiebreak)]);
    setAskThirdSet(false);
    requestAnimationFrame(() =>
      document.getElementById(`set-${i}-us`)?.focus(),
    );
  }

  async function resolveOpponent(choice: OpponentChoice): Promise<Opponent> {
    if (choice.kind === "existing") return choice.opponent;
    const { data, error } = await supabase
      .from("opponents")
      .insert({
        coach_id: userId,
        name: choice.name,
        school_id: choice.school?.id ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    const created = data as Opponent;
    setOpponents((prev) => [...prev, created]);
    return created;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!opp1)
      return setError(
        doubles
          ? "Choose or add the first opponent."
          : "Choose or add an opponent.",
      );
    if (doubles && !opp2) return setError("Choose or add the second opponent.");
    if (!playerId)
      return setError(
        doubles
          ? "Pick your first player."
          : "Pick which of your players played.",
      );
    if (doubles && !player2Id) return setError("Pick your second player.");
    if (doubles && player2Id === playerId)
      return setError("Pick two different players.");
    if (completeSets.length === 0)
      return setError("Enter at least one set score.");
    if (!outcome) return setError("Sets are level. Choose win or loss.");

    setBusy(true);
    try {
      const o1 = await resolveOpponent(opp1);
      const o2 = doubles && opp2 ? await resolveOpponent(opp2) : null;
      if (o2 && o2.id === o1.id)
        throw new Error("Pick two different opponents.");
      const p1 = players.find((p) => p.id === playerId)!;
      const p2 = doubles
        ? (players.find((p) => p.id === player2Id) ?? null)
        : null;
      const { error } = await supabase.from("results").insert({
        coach_id: userId,
        opponent_id: o1.id,
        opponent2_id: o2?.id ?? null,
        player_id: p1.id,
        player_name: p1.name,
        player2_id: p2?.id ?? null,
        player2_name: p2?.name ?? null,
        format,
        sport: "tennis",
        played_on: playedOn,
        outcome,
        sets: completeSets,
        did_well_tags: didWellTags,
        struggled_tags: struggledTags,
        notes: notes.trim() || null,
      });
      if (error) throw error;
      setSaved({ id: o1.id, label: o2 ? `${o1.name} & ${o2.name}` : o1.name });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the result",
      );
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setOpp1(null);
    setOpp2(null);
    setSets(defaultSets(format));
    setOutcomeOverride(null);
    setDidWellTags([]);
    setStruggledTags([]);
    setNotes("");
    setSaved(null);
    setError(null);
  }

  if (!loaded) return <p className="text-slate-500">Loading…</p>;

  if (saved) {
    return (
      <div className="hero-glow mx-auto max-w-lg rounded-2xl" data-reveal>
        <div className="card relative overflow-hidden p-8 text-center">
          <div className="aurora aurora-sm opacity-40" aria-hidden="true" />
          <span className="bounce-in ball relative mx-auto grid size-16 place-items-center text-court-950">
            <Check size={30} strokeWidth={3} className="absolute" />
          </span>
          <h1 className="relative mt-4 text-2xl font-bold">Result saved</h1>
          <p className="relative mt-1 text-slate-500">
            Your notes on <strong>{saved.label}</strong> are ready for next
            time.
          </p>
          <div className="relative mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button className="btn-primary lift" onClick={resetForm}>
              <Plus size={16} strokeWidth={3} /> Add another result
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate(`/opponents?open=${saved.id}`)}
            >
              View opponent
            </button>
            <Link to="/" className="btn-ghost">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const opp1Id = opp1?.kind === "existing" ? opp1.opponent.id : null;
  const opp2Id = opp2?.kind === "existing" ? opp2.opponent.id : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <header data-reveal>
        <h1 className="text-2xl font-bold">Add a result</h1>
        <p className="mt-1 text-slate-500">
          Tennis · log the match and what you noticed about the opponent.
        </p>
      </header>

      {players.length === 0 && canManageTeam && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You haven&apos;t added any players yet.{" "}
          <Link to="/profile" className="font-semibold underline">
            Add players on your profile
          </Link>{" "}
          first.
        </div>
      )}

      {/* Format */}
      <section
        className="card p-5"
        data-reveal
        style={{ ["--d" as string]: "60ms" }}
      >
        <h2 className="mb-3 text-base font-semibold">Match format</h2>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          {(
            [
              { id: "singles", label: "Singles", icon: User },
              { id: "doubles", label: "Doubles", icon: Users },
            ] as { id: MatchFormat; label: string; icon: typeof User }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => changeFormat(f.id)}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 transition ${
                format === f.id
                  ? "bg-white text-court-800 shadow"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              aria-pressed={format === f.id}
            >
              <f.icon size={16} /> {f.label}
            </button>
          ))}
        </div>
        {doubles && (
          <p className="mt-2 text-xs text-slate-500">
            Doubles usually plays one set. Add more if needed.
          </p>
        )}
      </section>

      {/* Opponents */}
      <section
        className="card space-y-4 p-5"
        data-reveal
        style={{ ["--d" as string]: "120ms" }}
      >
        <h2 className="text-base font-semibold">
          {doubles ? "Opposing pair" : "Opponent"}
        </h2>
        <OpponentPicker
          label={doubles ? "Opponent 1" : "Opponent"}
          opponents={opponents}
          value={opp1}
          onChange={setOpp1}
          exclude={opp2Id ? [opp2Id] : []}
        />
        {doubles && (
          <OpponentPicker
            label="Opponent 2"
            opponents={opponents}
            value={opp2}
            onChange={setOpp2}
            exclude={opp1Id ? [opp1Id] : []}
            placeholder="Their partner"
          />
        )}
      </section>

      {/* Players & date */}
      <section
        className="card grid gap-4 p-5 sm:grid-cols-2"
        data-reveal
        style={{ ["--d" as string]: "180ms" }}
      >
        <div>
          <label className="label" htmlFor="player">
            {isPlayer ? "You" : doubles ? "Your player 1" : "Your player"}
          </label>
          <select
            id="player"
            className="input"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            disabled={players.length === 0 || isPlayer}
          >
            <option value="">Select a player…</option>
            {players
              .filter((p) => p.id !== player2Id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        {doubles && (
          <div>
            <label className="label" htmlFor="player2">
              {isPlayer ? "Your partner" : "Your player 2"}
            </label>
            <select
              id="player2"
              className="input"
              value={player2Id}
              onChange={(e) => setPlayer2Id(e.target.value)}
              disabled={players.length < 2}
            >
              <option value="">Select a partner…</option>
              {players
                .filter((p) => p.id !== playerId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="date">
            Date played
          </label>
          <input
            id="date"
            type="date"
            className="input block min-w-0 appearance-none"
            value={playedOn}
            onChange={(e) => setPlayedOn(e.target.value)}
            max={today()}
          />
        </div>
      </section>

      {/* Score */}
      <section
        className="card p-5"
        data-reveal
        style={{ ["--d" as string]: "240ms" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Score</h2>
          <span className="text-xs text-slate-500">
            {doubles ? "Your pair first" : "Your player first"}
          </span>
        </div>
        <div className="space-y-2">
          {sets.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-sm font-medium leading-tight text-slate-500">
                Set {i + 1}
                {s.tiebreak && (
                  <span className="block text-[11px] font-normal text-slate-400">
                    tiebreak
                  </span>
                )}
              </span>
              {(["us", "them"] as const).map((side, k) => (
                <span key={side} className="contents">
                  {k === 1 && <span className="text-slate-400">–</span>}
                  <input
                    id={`set-${i}-${side}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    maxLength={s.tiebreak ? 2 : undefined}
                    className="input w-20 text-center text-lg font-semibold"
                    value={s[side] ?? ""}
                    onChange={(e) => updateSet(i, side, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    aria-label={`Set ${i + 1}${s.tiebreak ? " tiebreak" : ""}, ${side === "us" ? "your side" : "opponent"}`}
                    placeholder="–"
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
        {askThirdSet ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">
              Was the third set a full set or a match tiebreak?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addSet(false)}
                className="btn-secondary px-3 py-1.5"
              >
                Full set
              </button>
              <button
                type="button"
                onClick={() => addSet(true)}
                className="btn-secondary px-3 py-1.5"
              >
                Match tiebreak
              </button>
              <button
                type="button"
                onClick={() => setAskThirdSet(false)}
                className="btn-ghost px-3 py-1.5 text-slate-500"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          sets.length < 5 && (
            <button
              type="button"
              onClick={() =>
                sets.length === 2 ? setAskThirdSet(true) : addSet()
              }
              className="btn-ghost mt-2 px-2 text-court-700"
            >
              <Plus size={16} /> Add set
            </button>
          )
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Outcome</span>
          {(["win", "loss"] as Outcome[]).map((o) => {
            const active = outcome === o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => setOutcomeOverride(o)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  active
                    ? o === "win"
                      ? "bg-court-600 text-white"
                      : "bg-red-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {o === "win" ? (
                  <Trophy size={14} className="mr-1 inline" />
                ) : null}
                {o === "win" ? "Win" : "Loss"}
              </button>
            );
          })}
          {outcomeOverride === null && autoOutcome && (
            <span className="text-xs text-slate-400">auto from sets</span>
          )}
        </div>
      </section>

      {/* Scouting report */}
      <section
        className="card space-y-4 p-5"
        data-reveal
        style={{ ["--d" as string]: "300ms" }}
      >
        <div>
          <h2 className="text-base font-semibold">Scouting report</h2>
          <p className="text-sm text-slate-500">
            Tag the shots {subject} did well and struggled with.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <ScoutingCard
            tone="good"
            title="Did well"
            subject={subject}
            tags={didWellTags}
            onTagsChange={setDidWellTags}
          />
          <ScoutingCard
            tone="bad"
            title="Struggled with"
            subject={subject}
            tags={struggledTags}
            onTagsChange={setStruggledTags}
          />
        </div>
        <div>
          <label className="label" htmlFor="notes">
            Notes{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            className="input min-h-20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Conditions, tactics that worked, anything else."
          />
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="btn-primary lift py-3 text-base"
          disabled={busy || players.length === 0}
        >
          {busy ? "Saving…" : "Save result"}
        </button>
        <Link to="/" className="btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
