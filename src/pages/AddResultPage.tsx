import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Minus, Plus, Trophy, User, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ShotTagPicker } from "../components/ShotTagPicker";
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

const emptySet = (): SetScore => ({ us: null, them: null });
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
  const [sets, setSets] = useState<SetScore[]>(defaultSets("singles"));
  const [outcomeOverride, setOutcomeOverride] = useState<Outcome | null>(null);
  const [didWell, setDidWell] = useState("");
  const [struggled, setStruggled] = useState("");
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

  function updateSet(i: number, key: keyof SetScore, raw: string) {
    const v =
      raw === "" ? null : Math.max(0, Math.min(99, parseInt(raw, 10) || 0));
    setSets((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [key]: v } : s)),
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
        did_well: didWell.trim() || null,
        struggled_with: struggled.trim() || null,
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
    setDidWell("");
    setStruggled("");
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
            className="input"
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
              <span className="w-12 shrink-0 text-sm font-medium text-slate-500">
                Set {i + 1}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                className="input w-20 text-center text-lg font-semibold"
                value={s.us ?? ""}
                onChange={(e) => updateSet(i, "us", e.target.value)}
                aria-label={`Set ${i + 1}, your side`}
                placeholder="–"
              />
              <span className="text-slate-400">–</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                className="input w-20 text-center text-lg font-semibold"
                value={s.them ?? ""}
                onChange={(e) => updateSet(i, "them", e.target.value)}
                aria-label={`Set ${i + 1}, opponent`}
                placeholder="–"
              />
              {sets.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setSets((p) => p.filter((_, idx) => idx !== i))
                  }
                  className="btn-ghost px-2 py-1.5 text-slate-400 hover:text-red-600"
                  aria-label={`Remove set ${i + 1}`}
                >
                  <Minus size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {sets.length < 5 && (
          <button
            type="button"
            onClick={() => setSets((p) => [...p, emptySet()])}
            className="btn-ghost mt-2 px-2 text-court-700"
          >
            <Plus size={16} /> Add set
          </button>
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

      {/* Notes */}
      <section
        className="card space-y-4 p-5"
        data-reveal
        style={{ ["--d" as string]: "300ms" }}
      >
        <h2 className="text-base font-semibold">
          {doubles ? "Notes on the pair" : "Opponent notes"}
        </h2>
        <div>
          <p className="label text-court-800">What {subject} did well</p>
          <ShotTagPicker
            value={didWellTags}
            onChange={setDidWellTags}
            tone="good"
            label="Did well tags"
          />
          <label className="sr-only" htmlFor="didWell">
            Notes on what {subject} did well
          </label>
          <textarea
            id="didWell"
            className="input mt-3 min-h-20"
            value={didWell}
            onChange={(e) => setDidWell(e.target.value)}
            placeholder={"Written notes (optional)"}
          />
        </div>
        <div>
          <p className="label text-amber-800">What {subject} struggled with</p>
          <ShotTagPicker
            value={struggledTags}
            onChange={setStruggledTags}
            tone="bad"
            label="Struggled with tags"
          />
          <label className="sr-only" htmlFor="struggled">
            Notes on what {subject} struggled with
          </label>
          <textarea
            id="struggled"
            className="input mt-3 min-h-20"
            value={struggled}
            onChange={(e) => setStruggled(e.target.value)}
            placeholder={"Written notes (optional)"}
          />
        </div>
        <div>
          <label className="label" htmlFor="notes">
            Other notes{" "}
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
