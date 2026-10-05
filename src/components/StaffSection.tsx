import { useEffect, useState } from "react";
import { BadgeCheck, Trash2, Unlink, UserPlus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { inviteLink } from "../lib/invite";
import {
  STAFF_ROLES,
  staffRoleLabel,
  type Staff,
  type StaffRole,
} from "../lib/types";
import { ConfirmModal } from "./Modal";
import { InviteLinkModal } from "./InviteLinkModal";
import { RosterLead, RosterStatus } from "./RosterRowActions";

/**
 * The team's staff (assistant coaches, team managers, SIDs).
 * The head coach adds, invites and removes them; everyone else sees the list.
 */
export function StaffSection({ className = "" }: { className?: string }) {
  const { ownerId, profile, canManageTeam, staff: me } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<Record<string, string>>({}); // staff_id -> token
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("assistant_coach");
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState<Staff | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [toRemove, setToRemove] = useState<Staff | null>(null);
  const [toUnlink, setToUnlink] = useState<Staff | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    supabase
      .from("staff")
      .select("*")
      .eq("coach_id", ownerId)
      .order("created_at")
      .then(({ data }) => {
        setStaff((data as Staff[]) ?? []);
        setLoading(false);
      });
    if (!canManageTeam) return;
    supabase
      .from("staff_invites")
      .select("staff_id, token")
      .eq("coach_id", ownerId)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const row of (data as { staff_id: string; token: string }[]) ??
          [])
          map[row.staff_id] = row.token;
        setInvites(map);
      });
  }, [ownerId, canManageTeam]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !ownerId) return;
    setAdding(true);
    setError(null);
    const { data, error } = await supabase
      .from("staff")
      .insert({ coach_id: ownerId, name: trimmed, role })
      .select("*")
      .single();
    setAdding(false);
    if (error) return setError(error.message);
    setStaff((s) => [...s, data as Staff]);
    setName("");
  }

  async function changeRole(s: Staff, next: StaffRole) {
    setError(null);
    setStaff((list) =>
      list.map((x) => (x.id === s.id ? { ...x, role: next } : x)),
    );
    const { error } = await supabase
      .from("staff")
      .update({ role: next })
      .eq("id", s.id);
    if (error) {
      setError(error.message);
      setStaff((list) =>
        list.map((x) => (x.id === s.id ? { ...x, role: s.role } : x)),
      );
    }
  }

  /** Opens the invite dialog, creating the link the first time. */
  async function openInvite(s: Staff, regenerate = false) {
    setInviting(s);
    setError(null);
    if (invites[s.id] && !regenerate) return;
    setInviteBusy(true);
    if (regenerate)
      await supabase.from("staff_invites").delete().eq("staff_id", s.id);
    const { data, error } = await supabase
      .from("staff_invites")
      .insert({ staff_id: s.id, coach_id: ownerId })
      .select("token")
      .single();
    setInviteBusy(false);
    if (error) {
      setError(error.message);
      setInviting(null);
      return;
    }
    setInvites((m) => ({ ...m, [s.id]: (data as { token: string }).token }));
  }

  async function confirmRemove() {
    if (!toRemove) return;
    setWorking(true);
    const { error } = await supabase
      .from("staff")
      .delete()
      .eq("id", toRemove.id);
    setWorking(false);
    if (error) return setError(error.message);
    setStaff((s) => s.filter((x) => x.id !== toRemove.id));
    setToRemove(null);
  }

  async function confirmUnlink() {
    if (!toUnlink) return;
    setWorking(true);
    const { error } = await supabase.rpc("unlink_staff", {
      p_staff_id: toUnlink.id,
    });
    setWorking(false);
    if (error) return setError(error.message);
    setStaff((s) =>
      s.map((x) =>
        x.id === toUnlink.id ? { ...x, user_id: null, claimed_at: null } : x,
      ),
    );
    setToUnlink(null);
  }

  const statusOf = (s: Staff): "joined" | "pending" | "none" =>
    s.user_id ? "joined" : invites[s.id] ? "pending" : "none";

  if (!canManageTeam && !loading && staff.length === 0) return null;
  const team = profile?.team_name || "your team";

  return (
    <section className={className}>
      <div className="mb-2">
        <h2 className="text-base font-semibold">Staff</h2>
        {canManageTeam && (
          <p className="text-sm text-slate-500">
            Add assistant coaches, team managers and SIDs. Once they join they
            can see every match and log results for the team.
          </p>
        )}
      </div>

      {canManageTeam && (
        <form onSubmit={add} className="card mb-3 flex flex-wrap gap-2 p-3">
          <input
            className="input min-w-0 flex-1 basis-48"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Staff member's name"
            aria-label="New staff member name"
          />
          <select
            className="input w-auto"
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
            aria-label="Staff role"
          >
            {STAFF_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="btn-primary shrink-0"
            disabled={adding || !name.trim()}
          >
            <UserPlus size={16} /> Add staff
          </button>
        </form>
      )}

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : staff.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">
          No staff yet. Add your first one above.
        </div>
      ) : (
        <ul className="grid gap-3">
          {staff.map((s) => {
            const status = statusOf(s);
            const isMe = me?.id === s.id;
            return (
              <li
                key={s.id}
                className={`card flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-4 ${isMe ? "border-court-300" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {canManageTeam ? (
                    <RosterLead
                      player={s}
                      status={status}
                      onInvite={() => openInvite(s)}
                    />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
                      <BadgeCheck size={18} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {s.name}
                      {isMe && (
                        <span className="ml-2 text-xs font-medium text-court-700">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      {canManageTeam ? (
                        <RosterStatus status={status} />
                      ) : (
                        staffRoleLabel(s.role)
                      )}
                    </p>
                  </div>
                </div>
                {canManageTeam && (
                  <div className="flex shrink-0 items-center gap-1">
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      value={s.role}
                      onChange={(e) =>
                        changeRole(s, e.target.value as StaffRole)
                      }
                      aria-label={`${s.name}'s role`}
                    >
                      {STAFF_ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {status === "joined" && (
                      <button
                        onClick={() => setToUnlink(s)}
                        className="btn-ghost px-2.5 py-1.5 text-slate-600"
                        title={`Unlink ${s.name}'s account`}
                        aria-label={`Unlink ${s.name}'s account`}
                      >
                        <Unlink size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => setToRemove(s)}
                      className="btn-ghost px-2.5 py-1.5 text-red-600 hover:bg-red-50"
                      aria-label={`Remove ${s.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <InviteLinkModal
        open={inviting !== null}
        title={`Invite ${inviting?.name ?? ""}`}
        message={
          <>
            Send this link to <strong>{inviting?.name}</strong>. When they sign
            in with Google they join {team} as{" "}
            {inviting ? staffRoleLabel(inviting.role) : "staff"}. The link works
            once.
          </>
        }
        url={
          inviteBusy || !inviting || !invites[inviting.id]
            ? ""
            : inviteLink(invites[inviting.id])
        }
        shareText={`${inviting?.name ?? ""}, join ${profile?.team_name || "our team"} on WhosMyOpponent:`}
        onRegenerate={() => inviting && openInvite(inviting, true)}
        onClose={() => setInviting(null)}
      />

      <ConfirmModal
        open={toUnlink !== null}
        title="Unlink this account?"
        message={
          <>
            <strong>{toUnlink?.name}</strong>&apos;s account will lose access to
            your team. You can invite someone to the spot again.
          </>
        }
        confirmLabel="Unlink"
        danger
        busy={working}
        onConfirm={confirmUnlink}
        onCancel={() => setToUnlink(null)}
      />

      <ConfirmModal
        open={toRemove !== null}
        title="Remove staff member?"
        message={
          <>
            <strong>{toRemove?.name}</strong> will be removed from your staff.
            {toRemove?.user_id
              ? " Their account will lose access to the team."
              : ""}
          </>
        }
        confirmLabel="Remove"
        danger
        busy={working}
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      />
    </section>
  );
}
