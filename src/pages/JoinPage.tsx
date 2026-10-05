import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { signInWithGoogle } from "../lib/nativeAuth";
import { isNative } from "../lib/platform";
import { useDarkStatusBar } from "../lib/nativeUi";
import { useAuth } from "../lib/auth";
import { forgetInvite, rememberInvite } from "../lib/invite";
import { GoogleIcon } from "../components/GoogleIcon";
import { AppleButton } from "../components/AppleButton";
import { BrandLockup } from "../components/Brand";
import { staffRoleLabel, type StaffRole } from "../lib/types";

interface Preview {
  kind: "player" | "staff";
  staff_role: StaffRole | null;
  player_name: string;
  team_name: string | null;
  coach_name: string | null;
}

export function JoinPage() {
  const { token = "" } = useParams();
  const { session, profile, isAdmin, admin, loading, refreshProfile, signOut } =
    useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDarkStatusBar();

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
    const error = await signInWithGoogle(`/join/${token}`);
    if (error) setError(error);
    // On the web the page is navigating away to Google; in the app the sign-in sheet has closed.
    if (error || isNative) setBusy(false);
  }

  async function claim() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("claim_invite", {
      p_token: token,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    forgetInvite();
    const claimed = data as {
      kind: "player" | "staff";
      player_id: string;
      coach_id: string;
    } | null;
    if (isAdmin && claimed?.kind === "player") {
      admin.setViewAs("player");
      admin.setTeamId(claimed.coach_id);
      admin.setPlayerId(claimed.player_id);
    }
    await refreshProfile();
    setBusy(false);
    setDone(true);
  }

  function decline() {
    forgetInvite();
    navigate("/", { replace: true });
  }

  const team = preview?.team_name || "the team";
  const isStaffInvite = preview?.kind === "staff";
  const roleLabel =
    isStaffInvite && preview?.staff_role
      ? staffRoleLabel(preview.staff_role)
      : "player";
  const alreadyCoach =
    !isAdmin && !!profile && profile.onboarded && profile.role === "coach";

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-court-900 text-white">
      <div className="aurora hue-drift" aria-hidden="true" />
      <header className="relative flex items-center justify-between px-6 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <BrandLockup onDark size="sm" />
        {session && (
          <button
            onClick={signOut}
            className="text-sm text-slate-300 hover:text-white"
          >
            Sign out
          </button>
        )}
      </header>

      <main className="relative mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-8">
        {!checked || loading ? (
          <p className="text-center text-slate-300">Checking your invite…</p>
        ) : done ? (
          <div className="slide-in-right text-center">
            <span className="bounce-in ball relative mx-auto grid size-20 place-items-center text-court-950">
              <Check size={36} strokeWidth={3} className="absolute" />
            </span>
            <h1 className="mt-6 text-3xl font-bold">You&apos;re on {team}.</h1>
            <p className="mt-3 text-slate-300">
              {isStaffInvite
                ? "You can now see every team match and log results and notes on opponents."
                : "You can now log your own matches and notes on the opponents you face."}
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
              Go to WhosMyOpponent
            </Link>
          </div>
        ) : (
          <div className="slide-in-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-ball">
              You&apos;re invited
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
              Join {team} as {isStaffInvite ? "" : "a "}
              {roleLabel}.
            </h1>
            <p className="mt-3 text-slate-300">
              {preview.coach_name
                ? `${preview.coach_name} has`
                : "Your coach has"}{" "}
              saved a spot for{" "}
              <strong className="text-white">{preview.player_name}</strong>.
              {isStaffInvite
                ? "Claim it to follow and log the team's matches."
                : "Claim it to log your own matches and notes."}
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
                <>
                  <AppleButton
                    label="Continue with Apple to claim"
                    className="ring-1 ring-white/20"
                    onError={setError}
                  />
                  <button
                    onClick={signIn}
                    disabled={busy}
                    className="btn lift bg-white py-3 text-base text-slate-900"
                  >
                    <GoogleIcon />{" "}
                    {busy ? "Redirecting…" : "Continue with Google to claim"}
                  </button>
                </>
              ) : alreadyCoach ? (
                <p className="rounded-xl bg-amber-500/20 px-4 py-3 text-sm text-amber-100">
                  You&apos;re signed in with an account that already coaches a
                  team. Sign out and use a different account to join as{" "}
                  {isStaffInvite ? roleLabel : "a player"}.
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
