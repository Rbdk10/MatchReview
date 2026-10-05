import { Capacitor } from "@capacitor/core";

/** True inside the iOS/Android app shell, false in a browser. */
export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === "ios";

/** The public website. Links people share must point here, never at the app's own origin. */
export const WEB_ORIGIN =
  (import.meta.env.VITE_PUBLIC_URL as string | undefined) ??
  "https://whosmyopponent.netlify.app";

/** Origin for links that leave the device (invite links, OAuth returns on the web). */
export function publicOrigin(): string {
  return isNative ? WEB_ORIGIN : window.location.origin;
}

/** Custom URL scheme registered in ios/App/App/Info.plist. */
export const APP_SCHEME = "whosmyopponent";
