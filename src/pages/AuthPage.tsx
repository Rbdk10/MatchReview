import { useEffect, useRef, useState } from "react";
import { useReveal } from "../lib/useReveal";
import { signInWithGoogle as startGoogleSignIn } from "../lib/nativeAuth";
import { useDarkStatusBar } from "../lib/nativeUi";
import { isIOS, isNative } from "../lib/platform";
import { GoogleIcon } from "../components/GoogleIcon";
import { Words } from "../components/Words";
import { AppleButton } from "../components/AppleButton";
import { BrandMark, Wordmark } from "../components/Brand";

export function AuthPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  useReveal(pageRef);
  useDarkStatusBar();

  // Supabase sends OAuth failures back as ?error=...&error_description=...
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const desc = qs.get("error_description") ?? qs.get("error");
    if (desc) {
      setError(desc.replace(/\+/g, " "));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    const error = await startGoogleSignIn("/", {
      access_type: "offline",
      prompt: "select_account",
    });
    if (error) setError(error);
    // On the web the page is navigating away to Google; in the app the sign-in sheet has closed.
    if (error || isNative) setBusy(false);
  }

  const appleToo = isNative && isIOS;

  return (
    <div
      ref={pageRef}
      className="relative flex min-h-full flex-col overflow-hidden bg-court-900 md:flex-row"
    >
      <div className="aurora hue-drift" aria-hidden="true" />
      {/* Orbiting ball, desktop only */}
      <div
        className="pointer-events-none absolute left-[38%] top-[50%] hidden md:block"
        aria-hidden="true"
        style={{ ["--orbit" as string]: "260px", ["--speed" as string]: "34s" }}
      >
        <span className="orbit">
          <span className="ball float size-16" />
        </span>
      </div>

      {/* Brand panel */}
      <div className="relative flex flex-col justify-center px-6 pb-10 pt-[calc(env(safe-area-inset-top)+2.5rem)] text-white md:w-1/2 md:px-16 md:pt-10">
        <div className="flex flex-col items-start gap-5" data-reveal>
          <BrandMark tile className="float size-16 rounded-[22%] shadow-2xl" />
          <h2 aria-label="WhosMyOpponent">
            <Wordmark onDark className="text-[2.1rem] md:text-6xl" />
          </h2>
        </div>
        <h1 className="mt-6 text-2xl font-bold leading-[1.15] text-white md:text-4xl">
          <Words
            text="Know every opponent before your players step on court."
            start={150}
            step={55}
          />
        </h1>
        <p
          className="mt-5 max-w-md text-slate-300"
          data-reveal
          style={{ ["--d" as string]: "700ms" }}
        >
          Log results, capture what each opponent does well and where they
          struggle, and have it all ready for the next match.
        </p>
      </div>

      {/* Sheet */}
      <div className="relative flex flex-1 items-end md:items-center md:justify-center md:px-8">
        <div
          className="hero-glow w-full rounded-t-3xl md:max-w-md md:rounded-3xl"
          data-reveal
          style={{ ["--d" as string]: "450ms" }}
        >
          <div className="w-full rounded-t-3xl bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl md:rounded-3xl md:p-8">
            <h2 className="text-xl font-bold">Sign in to continue</h2>
            <p className="mt-1 text-sm text-slate-500">
              New here? Signing in with {appleToo ? "Apple or Google" : "Google"}{" "}
              creates your coach account automatically.
            </p>

            <AppleButton className="mt-6" onError={setError} />
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              className={`btn-secondary lift w-full py-3 text-base ${appleToo ? "mt-3" : "mt-6"}`}
            >
              <GoogleIcon />
              {busy ? "Redirecting…" : "Continue with Google"}
            </button>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <p className="mt-6 text-center text-xs text-slate-400">
              We only use your {appleToo ? "account" : "Google account"} to sign
              you in. Nothing is posted on your behalf.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
