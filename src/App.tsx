import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { supabase } from "./lib/supabase";
import { pendingInvite } from "./lib/invite";
import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { HomePage } from "./pages/HomePage";
import { AddResultPage } from "./pages/AddResultPage";
import { OpponentsPage } from "./pages/OpponentsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { JoinPage } from "./pages/JoinPage";
import { TeamPage } from "./pages/TeamPage";
import { PlayerPage } from "./pages/PlayerPage";
import { AdminEmpty } from "./components/AdminBar";
import { BrandMark } from "./components/Brand";
import { useDarkStatusBar } from "./lib/nativeUi";

function Splash() {
  return (
    <div className="grid min-h-full place-items-center text-slate-500">
      <div className="flex flex-col items-center gap-3">
        <BrandMark
          tile
          className="breathe size-14 rounded-[22%] shadow-md ring-1 ring-black/10"
        />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}

/** Shown to a player or staff account whose coach removed or unlinked their team spot. */
function NoTeam() {
  const { session, refreshProfile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  useDarkStatusBar();
  async function startOwnTeam() {
    if (!session) return;
    setBusy(true);
    await supabase
      .from("profiles")
      .update({ role: "coach", onboarded: false, school_id: null })
      .eq("id", session.user.id);
    await refreshProfile();
    setBusy(false);
  }
  return (
    <div className="grid min-h-full place-items-center bg-court-900 px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-center text-white">
      <div className="max-w-md">
        <BrandMark tile className="mx-auto size-14 rounded-[22%]" />
        <h1 className="mt-5 text-2xl font-bold">
          You&apos;re not on a team right now
        </h1>
        <p className="mt-2 text-slate-300">
          Your coach removed or unlinked your spot. Ask them for a new invite
          link, or start your own team as a coach.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            onClick={startOwnTeam}
            disabled={busy}
            className="btn bg-ball text-court-950"
          >
            {busy ? "Working…" : "Start my own team"}
          </button>
          <button
            onClick={signOut}
            className="btn bg-white/10 text-white hover:bg-white/20"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function Protected() {
  const {
    session,
    profile,
    player,
    staff,
    isPlayer,
    isStaff,
    isAdmin,
    ownerId,
    scopeKey,
    loading,
  } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!session) return <Navigate to="/auth" replace />;
  if (!profile) return <Splash />;
  if (isAdmin) {
    if (!ownerId || (isPlayer && !player)) return <AdminEmpty />;
    return <Layout key={scopeKey} />;
  }
  if (!profile.onboarded) {
    // Someone who opened an invite link goes back to it instead of the coach setup.
    const token = pendingInvite();
    if (token) return <Navigate to={`/join/${token}`} replace />;
    return <OnboardingPage />;
  }
  if ((isPlayer && !player) || (isStaff && !staff)) return <NoTeam />;
  if (location.pathname === "/welcome") return <Navigate to="/" replace />;
  return <Layout />;
}

export default function App() {
  const { session, loading } = useAuth();
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          loading ? (
            <Splash />
          ) : session ? (
            <Navigate to="/" replace />
          ) : (
            <AuthPage />
          )
        }
      />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route element={<Protected />}>
        <Route index element={<HomePage />} />
        <Route path="/add" element={<AddResultPage />} />
        <Route path="/opponents" element={<OpponentsPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/team/:playerId" element={<PlayerPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/welcome" element={<HomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
