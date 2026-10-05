import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { SPORTS, type Player, type Sport } from "../lib/types";
import { Words } from "../components/Words";
import {
  SchoolPicker,
  schoolFromProfile,
  type School,
} from "../components/SchoolPicker";

const STEPS = ["welcome", "team", "sport", "players", "done"] as const;
type Step = (typeof STEPS)[number];

export function OnboardingPage() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const userId = session!.user.id;

  const [step, setStep] = useState<Step>("welcome");
  const [dir, setDir] = useState<1 | -1>(1);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [school, setSchool] = useState<School | null>(
    schoolFromProfile(profile),
  );
  const teamName = school?.name ?? "";
  const [sport, setSport] = useState<Sport | null>(profile?.sport ?? "tennis");
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayer, setNewPlayer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("players")
      .select("*")
      .order("created_at")
      .then(({ data }) => setPlayers((data as Player[]) ?? []));
  }, []);

  useEffect(() => {
    if (step === "players") playerInput.current?.focus();
  }, [step]);

  const index = STEPS.indexOf(step);
  const canContinue =
    step === "welcome"
      ? fullName.trim().length > 0
      : step === "team"
        ? !!school
        : step === "sport"
          ? !!sport
          : true;

  function go(next: Step) {
    setDir(STEPS.indexOf(next) > index ? 1 : -1);
    setError(null);
    setStep(next);
  }
  function back() {
    if (index > 0) go(STEPS[index - 1]);
  }

  async function next() {
    if (!canContinue) return;
    if (step === "players") {
      // Persist everything, then show the finish slide.
      setBusy(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          school_id: school?.id ?? null,
          sport,
          onboarded: true,
        })
        .eq("id", userId);
      setBusy(false);
      if (error) {
        setError(error.message);
        return;
      }
      go("done");
      return;
    }
    if (step === "done") {
      await refreshProfile();
      navigate("/", { replace: true });
      return;
    }
    go(STEPS[index + 1]);
  }

  async function addPlayer(e: FormEvent) {
    e.preventDefault();
    const name = newPlayer.trim();
    if (!name) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("players")
      .insert({ coach_id: userId, name })
      .select("*")
      .single();
    setBusy(false);
    if (error) return setError(error.message);
    setPlayers((p) => [...p, data as Player]);
    setNewPlayer("");
    playerInput.current?.focus();
  }

  async function removePlayer(p: Player) {
    const { error } = await supabase.from("players").delete().eq("id", p.id);
    if (error) return setError(error.message);
    setPlayers((list) => list.filter((x) => x.id !== p.id));
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && step !== "players") {
      e.preventDefault();
      void next();
    }
  }

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-court-900 text-white">
      <div className="aurora hue-drift" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-[82%] top-[78%] hidden md:block"
        aria-hidden="true"
        style={{ ["--orbit" as string]: "180px", ["--speed" as string]: "40s" }}
      >
        <span className="orbit">
          <span className="ball float size-12" />
        </span>
      </div>

      {/* Top bar */}
      <header className="relative flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt=""
            className="size-9 drop-shadow-[0_6px_14px_rgba(212,232,70,.35)]"
          />
          <span className="font-bold tracking-tight">MatchReview</span>
        </div>
        <button
          onClick={signOut}
          className="text-sm text-slate-300 hover:text-white"
        >
          Sign out
        </button>
      </header>

      {/* Progress dots */}
      <ol
        className="relative mx-auto flex items-center gap-2"
        aria-label="Setup progress"
      >
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i <= index ? "w-8 bg-ball" : "w-3 bg-white/25"
            }`}
            aria-current={i === index ? "step" : undefined}
          />
        ))}
      </ol>

      {/* Slide */}
      <main
        className="relative mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-8"
        onKeyDown={onKey}
      >
        <div
          key={step}
          className={dir === 1 ? "slide-in-right" : "slide-in-left"}
        >
          {step === "welcome" && (
            <Slide
              eyebrow={`Step 1 of ${STEPS.length - 1}`}
              title="Welcome, coach."
              body="Let's set up your scouting book. First, what should we call you?"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void next();
                }}
              >
                <input
                  className="input-dark"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  autoFocus
                />
              </form>
            </Slide>
          )}

          {step === "team" && (
            <Slide
              eyebrow={`Step 2 of ${STEPS.length - 1}`}
              title="Choose your school."
              body="Pick the school you coach from the list. This names your team and keeps results grouped properly."
            >
              <SchoolPicker
                value={school}
                onChange={setSchool}
                placeholder="Search US schools"
                dark
              />
            </Slide>
          )}

          {step === "sport" && (
            <Slide
              eyebrow={`Step 3 of ${STEPS.length - 1}`}
              title="Which sport do you coach?"
              body="Pick the sport you coach."
            >
              <div className="grid max-w-44 grid-cols-1 gap-3">
                {SPORTS.map((s) => {
                  const active = sport === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSport(s.id)}
                      className={`lift relative flex flex-col items-center gap-2 rounded-2xl border-2 p-5 text-sm font-semibold transition ${
                        active
                          ? "border-ball bg-white/10"
                          : "border-white/15 bg-white/5 hover:border-white/40"
                      }`}
                    >
                      {active && (
                        <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-ball text-court-950">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                      <span
                        className={`ball size-12 ${active ? "float" : ""}`}
                      />
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-sm text-white/50">
                Other sports coming soon.
              </p>
            </Slide>
          )}

          {step === "players" && (
            <Slide
              eyebrow={`Step 4 of ${STEPS.length - 1}`}
              title={`Who plays for ${teamName.trim() || "your team"}?`}
              body="Add your players now or later from your profile. You can always add more."
            >
              <form onSubmit={addPlayer} className="flex gap-2">
                <input
                  ref={playerInput}
                  className="input-dark"
                  value={newPlayer}
                  onChange={(e) => setNewPlayer(e.target.value)}
                  placeholder="Player name, then Enter"
                  aria-label="New player name"
                />
                <button
                  type="submit"
                  className="btn shrink-0 bg-ball text-court-950"
                  disabled={busy || !newPlayer.trim()}
                >
                  <Plus size={16} strokeWidth={3} /> Add
                </button>
              </form>
              <ul className="mt-4 flex flex-wrap gap-2">
                {players.map((p) => (
                  <li
                    key={p.id}
                    className="expand-in flex items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1.5 pl-3 pr-1.5 text-sm"
                  >
                    {p.name}
                    <button
                      onClick={() => removePlayer(p)}
                      className="grid size-6 place-items-center rounded-full text-white/60 hover:bg-red-500/30 hover:text-white"
                      aria-label={`Remove ${p.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
                {players.length === 0 && (
                  <li className="text-sm text-white/50">No players yet.</li>
                )}
              </ul>
            </Slide>
          )}

          {step === "done" && (
            <div className="text-center">
              <span className="bounce-in ball relative mx-auto grid size-20 place-items-center text-court-950">
                <Check size={36} strokeWidth={3} className="absolute" />
              </span>
              <h1 className="mt-6 text-3xl font-bold md:text-4xl">
                <Words
                  text={`${teamName.trim()} is ready.`}
                  start={200}
                  step={70}
                />
              </h1>
              <p
                className="mt-3 text-slate-300"
                data-reveal
                style={{ ["--d" as string]: "600ms" }}
              >
                {players.length} player{players.length === 1 ? "" : "s"} on the
                roster. Time to log your first result.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        {/* Controls */}
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            className={`btn text-slate-300 hover:text-white ${index === 0 || step === "done" ? "invisible" : ""}`}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!canContinue || busy}
            className="btn lift bg-ball px-6 py-3 text-base text-court-950 shadow-lg"
          >
            {busy
              ? "Saving…"
              : step === "done"
                ? "Go to dashboard"
                : step === "players"
                  ? "Finish setup"
                  : "Continue"}
            {!busy && <ArrowRight size={18} strokeWidth={2.5} />}
          </button>
        </div>
      </main>
    </div>
  );
}

function Slide({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-ball">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-slate-300">{body}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
