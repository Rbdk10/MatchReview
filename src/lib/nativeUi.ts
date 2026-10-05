import { useEffect } from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Share } from "@capacitor/share";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNative } from "./platform";

/** A light tap of haptic feedback in the app; nothing on the web. */
export function tapFeedback() {
  if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export const canShare =
  isNative ||
  (typeof navigator !== "undefined" && typeof navigator.share === "function");

/** Opens the system share sheet. Resolves quietly if the user dismisses it. */
export async function shareLink(opts: { title: string; text: string; url: string }) {
  try {
    if (isNative) await Share.share({ ...opts, dialogTitle: opts.title });
    else await navigator.share(opts);
  } catch {
    /* share sheet dismissed */
  }
}

/**
 * Light status bar text while a dark full-screen page is showing.
 * Every other screen has a white header, so it reverts to dark text on unmount.
 */
export function useDarkStatusBar() {
  useEffect(() => {
    if (!isNative) return;
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    return () => {
      void StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    };
  }, []);
}
