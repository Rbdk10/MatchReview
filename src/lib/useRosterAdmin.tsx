import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Check, Copy, RefreshCw, Share2 } from "lucide-react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { inviteLink } from "./invite";
import type { Player } from "./types";
import { ConfirmModal, Modal } from "../components/Modal";

/**
 * Coach-only roster management shared by the Team and Profile pages:
 * add players, invite them to claim their spot, unlink a joined account, remove a player.
 * Render `dialogs` once somewhere in the page.
 */
export function useRosterAdmin(setPlayers: Dispatch<SetStateAction<Player[]>>) {
  const { session, profile, isPlayer } = useAuth();
  const userId = session?.user.id ?? "";

  const [invites, setInvites] = useState<Record<string, string>>({}); // player_id -> token
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState<Player | null>(null);
  const [toUnlink, setToUnlink] = useState<Player | null>(null);
  const [inviting, setInviting] = useState<Player | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPlayer) return;
    supabase
      .from("player_invites")
      .select("player_id, token")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const row of (data as { player_id: string; token: string }[]) ??
          [])
          map[row.player_id] = row.token;
        setInvites(map);
      });
  }, [isPlayer]);

  const addPlayer = useCallback(
    async (rawName: string): Promise<boolean> => {
      const name = rawName.trim();
      if (!name || !userId) return false;
      setAdding(true);
      setError(null);
      const { data, error } = await supabase
        .from("players")
        .insert({ coach_id: userId, name })
        .select("*")
        .single();
      setAdding(false);
      if (error) {
        setError(error.message);
        return false;
      }
      setPlayers((p) =>
        [...p, data as Player].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return true;
    },
    [userId, setPlayers],
  );

  /** Opens the invite dialog, creating the link the first time. */
  async function openInvite(p: Player, regenerate = false) {
    setInviting(p);
    setCopied(false);
    setError(null);
    if (invites[p.id] && !regenerate) return;
    setInviteBusy(true);
    if (regenerate)
      await supabase.from("player_invites").delete().eq("player_id", p.id);
    const { data, error } = await supabase
      .from("player_invites")
      .insert({ player_id: p.id, coach_id: userId })
      .select("token")
      .single();
    setInviteBusy(false);
    if (error) {
      setError(error.message);
      setInviting(null);
      return;
    }
    setInvites((m) => ({ ...m, [p.id]: (data as { token: string }).token }));
  }

  async function confirmRemove() {
    if (!toRemove) return;
    setWorking(true);
    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", toRemove.id);
    setWorking(false);
    if (error) return setError(error.message);
    setPlayers((p) => p.filter((x) => x.id !== toRemove.id));
    setToRemove(null);
  }

  async function confirmUnlink() {
    if (!toUnlink) return;
    setWorking(true);
    const { error } = await supabase.rpc("unlink_player", {
      p_player_id: toUnlink.id,
    });
    setWorking(false);
    if (error) return setError(error.message);
    setPlayers((p) =>
      p.map((x) =>
        x.id === toUnlink.id ? { ...x, user_id: null, claimed_at: null } : x,
      ),
    );
    setToUnlink(null);
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        "Could not copy automatically. Select the link and copy it manually.",
      );
    }
  }

  async function shareLink(p: Player, url: string) {
    try {
      await navigator.share({
        title: "Join our team on MatchReview",
        text: `${p.name}, claim your spot on ${profile?.team_name || "our team"}:`,
        url,
      });
    } catch {
      /* share sheet dismissed */
    }
  }

  const inviteUrl =
    inviting && invites[inviting.id] ? inviteLink(invites[inviting.id]) : "";
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  /** "joined" | "pending" | "none" for a roster row. */
  const statusOf = (p: Player): "joined" | "pending" | "none" =>
    p.user_id ? "joined" : invites[p.id] ? "pending" : "none";

  const dialogs: ReactNode = (
    <>
      <Modal
        open={inviting !== null}
        title={`Invite ${inviting?.name ?? ""}`}
        onClose={() => setInviting(null)}
      >
        <p className="text-sm text-slate-600">
          Send this link to <strong>{inviting?.name}</strong>. When they sign in
          with Google they claim this spot on{" "}
          {profile?.team_name || "your team"}. The link works once.
        </p>
        {inviteBusy || !inviteUrl ? (
          <p className="mt-4 text-sm text-slate-500">Creating link…</p>
        ) : (
          <>
            <input
              className="input mt-4 font-mono text-xs"
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Invite link"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                className="btn-ghost text-slate-500"
                onClick={() => inviting && openInvite(inviting, true)}
              >
                <RefreshCw size={15} /> New link
              </button>
              {canShare && (
                <button
                  className="btn-secondary"
                  onClick={() => inviting && shareLink(inviting, inviteUrl)}
                >
                  <Share2 size={15} /> Share
                </button>
              )}
              <button
                className="btn-primary"
                onClick={() => copyLink(inviteUrl)}
              >
                {copied ? (
                  <Check size={15} strokeWidth={3} />
                ) : (
                  <Copy size={15} />
                )}{" "}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmModal
        open={toUnlink !== null}
        title="Unlink this account?"
        message={
          <>
            <strong>{toUnlink?.name}</strong>&apos;s account will lose access to
            your team. The player and their results stay, and you can invite
            someone to the spot again.
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
        title="Remove player?"
        message={
          <>
            <strong>{toRemove?.name}</strong> will be removed from your team.
            Results you&apos;ve logged for them are kept.
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
    </>
  );

  return {
    addPlayer,
    adding,
    openInvite,
    askUnlink: setToUnlink,
    askRemove: setToRemove,
    statusOf,
    dialogs,
    error,
  };
}
