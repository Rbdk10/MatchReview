import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { forgetInvite, rememberInvite } from "../lib/invite";
import { GoogleIcon } from "../components/GoogleIcon";

interface Preview {
  player_name: string;
  team_name: string | null;
  coach_name: string | null;
}

export function JoinPage() {
  const { token = "" } = useParams();
  const { session, profile, loading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rememberInvite(token);
    supabase.rpc("invite_preview", { p_token: token }).then(({ data }) => {
      setPreview((data as Preview) ?? null);
      setChecked(true);
    });
  }, [token]);

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/join/${token}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  async function claim() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("claim_invite", { p_token: token });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    forgetInvite();
    await refreshProfile();
    setBusy(false);
    setDone(true);
  }

  function decline() {
    forgetInvite();
    navigate("/", { replace: true });
  }

  const team = preview?.team_name || "the team";
  const alreadyCoach =
    !!profile && profile.onboarded && profile.role === "coach";

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-court-900 text-white">
      <div className="aurora hue-drift" aria-hidden="true" />
      <header className="relative flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="size-9" />
          <span className="font-bold tracking-tight">MatchReview</span>
        </div>
        {session && (
          <button
            onClick={signOut}
            className="text-sm text-slate-300 hover:text-white"
          >
            Sign out
          </button>
        )}
      </header>

      <main className="relative mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-8">
        {!checked || loading ? (
          <p className="text-center text-slate-300">Checking your invite…</p>
        ) : done ? (
          <div className="slide-in-right text-center">
            <span className="bounce-in ball relative mx-auto grid size-20 place-items-center text-court-950">
              <Check size={36} strokeWidth={3} className="absolute" />
            </span>
            <h1 className="mt-6 text-3xl font-bold">You&apos;re on {team}.</h1>
            <p className="mt-3 text-slate-300">
              You can now log your own matches and notes on the opponents you
              face.
            </p>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="btn lift mt-8 bg-ball px-6 py-3 text-base text-court-950 shadow-lg"
            >
              Go to dashboard <ArrowRight size={18} strokeWidth={2.5} />
            </button>
          </div>
        ) : !preview ? (
          <div className="slide-in-right text-center">
            <h1 className="text-3xl font-bold">
              This invite isn&apos;t valid.
            </h1>
            <p className="mt-3 text-slate-300">
              It may have already been used or replaced. Ask your coach to send
              you a fresh link.
            </p>
            <Link
              to="/"
              onClick={forgetInvite}
              className="btn mt-8 bg-white/10 px-6 py-3 text-white hover:bg-white/20"
            >
              Go to MatchReview
            </Link>
          </div>
        ) : (
          <div className="slide-in-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-ball">
              You&apos;re invited
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
              Join {team} as a player.
            </h1>
            <p className="mt-3 text-slate-300">
              {preview.coach_name
                ? `${preview.coach_name} has`
                : "Your coach has"}{" "}
              saved a spot for{" "}
              <strong className="text-white">{preview.player_name}</strong>.
              Claim it to log your own matches and notes.
            </p>

            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4">
              <span className="grid size-11 place-items-center rounded-full bg-ball text-sm font-bold text-court-950">
                {preview.player_name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <div>
                <p className="font-semibold">{preview.player_name}</p>
                <p className="text-sm text-slate-300">{team}</p>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3">
              {!session ? (
                <button
                  onClick={signIn}
                  disabled={busy}
                  className="btn lift bg-white py-3 text-base text-slate-900"
                >
                  <GoogleIcon />{" "}
                  {busy ? "Redirecting…" : "Continue with Google to claim"}
                </button>
              ) : alreadyCoach ? (
                <p className="rounded-xl bg-amber-500/20 px-4 py-3 text-sm text-amber-100">
                  You&apos;re signed in with an account that already coaches a
                  team. Sign out and use a different Google account to join as a
                  player.
                </p>
              ) : (
                <>
                  <button
                    onClick={claim}
                    disabled={busy}
                    className="btn lift bg-ball py-3 text-base text-court-950 shadow-lg"
                  >
                    {busy
                      ? "Claiming…"
                      : `Claim my spot as ${preview.player_name.split(" ")[0]}`}
                  </button>
                  <button
                    onClick={decline}
                    className="btn text-slate-300 hover:text-white"
                  >
                    Not me, skip this invite
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
