import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Keyboard } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useAuth } from "../lib/auth";
import { completeNativeSignIn } from "../lib/nativeAuth";
import { APP_SCHEME, WEB_ORIGIN, isNative } from "../lib/platform";
import { supabase } from "../lib/supabase";

/** Maps a link that opened the app to an in-app path, or null if it isn't ours. */
function pathFromLink(url: string): string | null {
  if (url.startsWith(WEB_ORIGIN)) {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  }
  // matchreview://join/<token> → /join/<token>
  const prefix = `${APP_SCHEME}://`;
  if (url.startsWith(prefix)) return `/${url.slice(prefix.length)}`;
  return null;
}

/** Glue between the iOS/Android shell and the web app. Renders nothing; does nothing on the web. */
export function NativeShell() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const { loading } = useAuth();

  // One-time setup, plus the listeners that live for the whole app session.
  useEffect(() => {
    if (!isNative) return;
    document.documentElement.classList.add("native");
    void StatusBar.setStyle({ style: Style.Light }).catch(() => {});

    const subs = [
      // Deep links: the Google sign-in callback, invite links, and matchreview:// links.
      CapApp.addListener("appUrlOpen", async ({ url }) => {
        const afterSignIn = await completeNativeSignIn(url);
        const path = afterSignIn ?? pathFromLink(url);
        if (path) navigateRef.current(path, { replace: !!afterSignIn });
      }),
      // supabase-js only refreshes tokens while the app is in the foreground.
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void supabase.auth.startAutoRefresh();
        else void supabase.auth.stopAutoRefresh();
      }),
      // Android hardware back button.
      CapApp.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void CapApp.exitApp();
      }),
      // Hide the bottom tab bar while typing so it doesn't ride up on the keyboard.
      Keyboard.addListener("keyboardWillShow", () =>
        document.documentElement.classList.add("keyboard-open"),
      ),
      Keyboard.addListener("keyboardWillHide", () =>
        document.documentElement.classList.remove("keyboard-open"),
      ),
    ];

    // Never leave the launch screen up if something stalls.
    const fallback = window.setTimeout(() => void SplashScreen.hide(), 4000);
    return () => {
      window.clearTimeout(fallback);
      subs.forEach((s) => void s.then((h) => h.remove()));
    };
  }, []);

  // Keep the launch screen up until we know whether someone is signed in.
  useEffect(() => {
    if (isNative && !loading) void SplashScreen.hide({ fadeOutDuration: 200 });
  }, [loading]);

  return null;
}
