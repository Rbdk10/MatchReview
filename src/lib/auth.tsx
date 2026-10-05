import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Player, Profile, Role, Staff } from "./types";

const PROFILE_COLS =
  "id, full_name, team_name, school_id, sport, onboarded, role, is_admin";
const ADMIN_KEY = "mr-admin-view";

export interface AdminTeam {
  id: string;
  team_name: string | null;
  full_name: string | null;
  sport: Profile["sport"];
}

interface AdminView {
  viewAs: Role;
  teamId: string | null;
  playerId: string | null;
}

interface AuthContextValue {
  session: Session | null;
  /** Effective profile. For an admin this is the team/player they are viewing as. */
  profile: Profile | null;
  /** For the player view: the team spot being used. */
  player: Player | null;
  /** For a staff account: their staff spot. */
  staff: Staff | null;
  /** Whose team data this view works with (the coach's id). */
  ownerId: string | null;
  isPlayer: boolean;
  isStaff: boolean;
  /** Only the head coach (or an admin viewing as coach) manages the roster and staff. */
  canManageTeam: boolean;
  isAdmin: boolean;
  /** Admin-only controls. */
  admin: {
    view: AdminView;
    teams: AdminTeam[];
    teamPlayers: Player[];
    setViewAs: (v: Role) => void;
    setTeamId: (id: string) => void;
    setPlayerId: (id: string) => void;
  };
  /** Changes whenever the admin switches scope, so pages can remount and reload. */
  scopeKey: string;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readAdminView(): AdminView {
  try {
    const v = JSON.parse(localStorage.getItem(ADMIN_KEY) ?? "{}");
    return {
      viewAs: v.viewAs === "player" ? "player" : "coach",
      teamId: v.teamId ?? null,
      playerId: v.playerId ?? null,
    };
  } catch {
    return { viewAs: "coach", teamId: null, playerId: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ownProfile, setOwnProfile] = useState<Profile | null>(null);
  const [ownPlayer, setOwnPlayer] = useState<Player | null>(null);
  const [ownStaff, setOwnStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<AdminView>(readAdminView);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);

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
    if (next?.role === "player" && !next.is_admin) {
      const { data: row } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      setOwnPlayer((row as Player) ?? null);
    } else {
      setOwnPlayer(null);
    }
    if (next?.role === "staff" && !next.is_admin) {
      const { data: row } = await supabase
        .from("staff")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      setOwnStaff((row as Staff) ?? null);
    } else {
      setOwnStaff(null);
    }
    setOwnProfile(next);
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
        setOwnProfile(null);
        setOwnPlayer(null);
        setOwnStaff(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const isAdmin = !!ownProfile?.is_admin;

  // Admin: every coach's team.
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("profiles")
      .select("id, team_name, full_name, sport")
      .eq("role", "coach")
      .eq("is_admin", false)
      .order("team_name")
      .then(({ data }) => setTeams((data as AdminTeam[]) ?? []));
  }, [isAdmin]);

  const teamId = isAdmin
    ? (teams.find((t) => t.id === view.teamId)?.id ?? teams[0]?.id ?? null)
    : null;

  // Admin: players on the team being viewed.
  useEffect(() => {
    if (!isAdmin || !teamId) {
      setTeamPlayers([]);
      return;
    }
    supabase
      .from("players")
      .select("*")
      .eq("coach_id", teamId)
      .order("name")
      .then(({ data }) => setTeamPlayers((data as Player[]) ?? []));
  }, [isAdmin, teamId]);

  const updateView = useCallback((patch: Partial<AdminView>) => {
    setView((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(ADMIN_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const team = teams.find((t) => t.id === teamId) ?? null;
  const adminPlayer =
    teamPlayers.find((p) => p.id === view.playerId) ?? teamPlayers[0] ?? null;

  const value = useMemo<AuthContextValue>(() => {
    const isPlayer = isAdmin
      ? view.viewAs === "player"
      : ownProfile?.role === "player";
    const isStaff = !isAdmin && ownProfile?.role === "staff";
    const player = isAdmin ? (isPlayer ? adminPlayer : null) : ownPlayer;
    const staff = isStaff ? ownStaff : null;
    const ownerId = isAdmin
      ? teamId
      : isPlayer
        ? (ownPlayer?.coach_id ?? null)
        : isStaff
          ? (ownStaff?.coach_id ?? null)
          : (session?.user.id ?? null);
    const profile: Profile | null =
      isAdmin && ownProfile
        ? {
            ...ownProfile,
            role: view.viewAs,
            team_name: team?.team_name ?? null,
            sport: team?.sport ?? "tennis",
            full_name: isPlayer
              ? (adminPlayer?.name ?? null)
              : (team?.full_name ?? null),
            onboarded: true,
          }
        : ownProfile;
    return {
      session,
      profile,
      player,
      staff,
      ownerId,
      isPlayer,
      isStaff,
      canManageTeam: !isPlayer && !isStaff,
      isAdmin,
      admin: {
        view: {
          viewAs: view.viewAs,
          teamId,
          playerId: adminPlayer?.id ?? null,
        },
        teams,
        teamPlayers,
        setViewAs: (v) => updateView({ viewAs: v }),
        setTeamId: (id) => updateView({ teamId: id, playerId: null }),
        setPlayerId: (id) => updateView({ playerId: id }),
      },
      scopeKey: isAdmin
        ? `${view.viewAs}:${teamId}:${adminPlayer?.id ?? ""}`
        : "self",
      loading,
      refreshProfile: async () => {
        if (session) await loadProfile(session.user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [
    isAdmin,
    view.viewAs,
    ownProfile,
    ownPlayer,
    ownStaff,
    adminPlayer,
    teamId,
    team,
    teams,
    teamPlayers,
    session,
    loading,
    loadProfile,
    updateView,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
