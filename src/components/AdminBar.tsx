import { ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { BrandMark } from "./Brand";
import type { Role } from "../lib/types";

/** Admin-only switcher: view the app as a coach or a player, for any team. */
export function AdminBar({ compact = false }: { compact?: boolean }) {
  const { isAdmin, admin } = useAuth();
  if (!isAdmin) return null;
  const { view, teams, teamPlayers, setViewAs, setTeamId, setPlayerId } = admin;
  const selectCls = compact
    ? "min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
    : "w-full rounded-lg border border-court-700 bg-court-800 px-2 py-1.5 text-xs text-white";

  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2"
          : "rounded-xl border border-ball/30 bg-court-950/40 p-3"
      }
    >
      <p
        className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${
          compact ? "text-amber-800" : "text-ball"
        }`}
      >
        <ShieldCheck size={13} /> Admin
      </p>
      <div
        className={`grid grid-cols-2 rounded-lg p-0.5 text-xs font-semibold ${
          compact ? "bg-amber-100" : "mt-2 bg-court-800"
        }`}
        role="group"
        aria-label="View as"
      >
        {(["coach", "player"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setViewAs(r)}
            aria-pressed={view.viewAs === r}
            className={`rounded-md px-3 py-1 capitalize transition ${
              view.viewAs === r
                ? compact
                  ? "bg-white text-amber-900 shadow"
                  : "bg-ball text-court-950"
                : compact
                  ? "text-amber-800"
                  : "text-slate-300 hover:text-white"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      {teams.length === 0 ? (
        <p
          className={`text-xs ${compact ? "text-amber-800" : "mt-2 text-slate-400"}`}
        >
          No teams yet
        </p>
      ) : (
        <div
          className={compact ? "flex min-w-0 flex-1 gap-2" : "mt-2 space-y-2"}
        >
          <select
            className={selectCls}
            value={view.teamId ?? ""}
            onChange={(e) => setTeamId(e.target.value)}
            aria-label="Team"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.team_name || `${t.full_name || "Unnamed"}'s team`}
              </option>
            ))}
          </select>
          {view.viewAs === "player" && (
            <select
              className={selectCls}
              value={view.playerId ?? ""}
              onChange={(e) => setPlayerId(e.target.value)}
              aria-label="Player"
              disabled={teamPlayers.length === 0}
            >
              {teamPlayers.length === 0 && <option value="">No players</option>}
              {teamPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

/** Shown to an admin when the chosen view has nothing to show yet. */
export function AdminEmpty() {
  const { admin, signOut } = useAuth();
  const noTeams = admin.teams.length === 0;
  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <AdminBar compact />
      <div className="grid flex-1 place-items-center px-6 text-center">
        <div className="max-w-sm">
          <BrandMark tile className="mx-auto size-14 rounded-[22%] shadow-sm ring-1 ring-black/10" />
          <h1 className="mt-4 text-xl font-bold">
            {noTeams ? "No teams yet" : "This team has no players yet"}
          </h1>
          <p className="mt-2 text-slate-500">
            {noTeams
              ? "When coaches sign up and set up their teams, you can view them here as a coach or a player."
              : "Switch to the coach view, or pick another team, to look around."}
          </p>
          <button onClick={signOut} className="btn-ghost mt-6 text-slate-500">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
