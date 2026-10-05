import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Player, Profile } from "./types";

const PROFILE_COLS = "id, full_name, team_name, sport, onboarded, role";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  /** For accounts with the player role: the team spot they claimed. */
  player: Player | null;
  /** Whose team data this account works with: the coach's id (own id for coaches). */
  ownerId: string | null;
  isPlayer: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    let { data } = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", userId)
      .maybeSingle();
    if (!data) {
      // The DB trigger normally creates the row; fall back to creating it ourselves.
      const created = await supabase
        .from("profiles")
        .upsert({ id: userId })
        .select(PROFILE_COLS)
        .single();
      data = created.data;
    }
    const next = (data as Profile) ?? null;
    if (next?.role === "player") {
      const { data: row } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      setPlayer((row as Player) ?? null);
    } else {
      setPlayer(null);
    }
    setProfile(next);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      if (mounted) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        // Defer so we never await inside the auth callback.
        setTimeout(() => void loadProfile(next.user.id), 0);
      } else {
        setProfile(null);
        setPlayer(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const isPlayer = profile?.role === "player";
  const ownerId = isPlayer
    ? (player?.coach_id ?? null)
    : (session?.user.id ?? null);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        player,
        ownerId,
        isPlayer,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
