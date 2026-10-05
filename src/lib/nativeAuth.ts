import { Browser } from "@capacitor/browser";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { supabase } from "./supabase";
import { APP_SCHEME, isNative } from "./platform";

/**
 * Sign-in that works both on the web and inside the app.
 *
 * Google refuses OAuth inside embedded web views, so the app opens the Google page in the system
 * browser sheet and Supabase sends the user back through `whosmyopponent://auth-callback?code=…`.
 * The deep link is caught in NativeShell and finished with `completeNativeSignIn`.
 */

const CALLBACK = `${APP_SCHEME}://auth-callback`;
const NEXT_KEY = "mr-after-sign-in";

// Resolves the pending signInWithGoogle() once the browser sheet closes or the callback lands.
let finishPending: (() => void) | null = null;

/** Starts Google sign-in. Returns an error message, or null once the user is on their way. */
export async function signInWithGoogle(
  next = "/",
  queryParams: Record<string, string> = { prompt: "select_account" },
): Promise<string | null> {
  if (!isNative) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${next}`, queryParams },
    });
    // On success the browser navigates away to Google.
    return error?.message ?? null;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: CALLBACK, skipBrowserRedirect: true, queryParams },
  });
  if (error) return error.message;
  try {
    localStorage.setItem(NEXT_KEY, next);
  } catch {
    /* storage unavailable */
  }

  await new Promise<void>((resolve) => {
    finishPending = resolve;
    const closed = Browser.addListener("browserFinished", () => {
      void closed.then((h) => h.remove());
      finishPending?.();
    });
    void Browser.open({ url: data.url, presentationStyle: "popover" });
  });
  finishPending = null;
  return null;
}

/**
 * Finishes a Google sign-in from the deep link. Returns the in-app path to show next,
 * or null when the URL is not an auth callback.
 */
export async function completeNativeSignIn(url: string): Promise<string | null> {
  if (!url.startsWith(CALLBACK)) return null;
  void Browser.close().catch(() => {});

  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  new URLSearchParams(parsed.hash.replace(/^#/, "")).forEach((v, k) =>
    params.set(k, v),
  );

  let next = "/";
  try {
    next = localStorage.getItem(NEXT_KEY) || "/";
    localStorage.removeItem(NEXT_KEY);
  } catch {
    /* storage unavailable */
  }

  const code = params.get("code");
  let failure = params.get("error_description") ?? params.get("error");
  if (code && !failure) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failure = error?.message ?? null;
  }
  finishPending?.();
  if (failure) return `/auth?error_description=${encodeURIComponent(failure)}`;
  return next;
}

/* ------------------------------------------------------------------ */
/* Sign in with Apple (iOS app only)                                   */
/* ------------------------------------------------------------------ */

let appleReady: Promise<void> | null = null;

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Native Sign in with Apple, exchanged for a Supabase session with the identity token.
 * App Store rule 4.8 requires it in any iOS app that offers Google sign-in.
 */
export async function signInWithApple(): Promise<string | null> {
  try {
    appleReady ??= SocialLogin.initialize({ apple: {} });
    await appleReady;

    // Apple gets the hashed nonce, Supabase gets the raw one and checks they match.
    const rawNonce = crypto.randomUUID();
    const { result } = await SocialLogin.login({
      provider: "apple",
      options: { scopes: ["email", "name"], nonce: await sha256Hex(rawNonce) },
    });
    if (!result.idToken) return "Apple did not return a sign-in token.";

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: result.idToken,
      nonce: rawNonce,
    });
    if (error) return error.message;

    // Apple only shares the name on the very first sign-in, so keep it while we have it.
    const name = [result.profile?.givenName, result.profile?.familyName]
      .filter(Boolean)
      .join(" ");
    if (name && data.user) {
      await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("id", data.user.id)
        .eq("full_name", "");
    }
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Closing the Apple sheet is not an error worth showing.
    if (/cancel|1001/i.test(message)) return null;
    return message;
  }
}
