import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { isNative } from "./platform";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.",
  );
}

// iOS can clear a web view's localStorage under storage pressure, which would sign people out.
// In the app the session lives in native preferences instead.
const nativeStorage: SupportedStorage = {
  getItem: async (k) => (await Preferences.get({ key: k })).value,
  setItem: (k, v) => Preferences.set({ key: k, value: v }),
  removeItem: (k) => Preferences.remove({ key: k }),
};

export const supabase = createClient(url, key, {
  auth: {
    flowType: "pkce",
    // In the app the OAuth code arrives through a deep link, handled in lib/nativeAuth.
    detectSessionInUrl: !isNative,
    persistSession: true,
    autoRefreshToken: true,
    storage: isNative ? nativeStorage : undefined,
  },
});
