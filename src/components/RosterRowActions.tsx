import { Link } from "react-router-dom";
import {
  Check,
  ClipboardPlus,
  Link2,
  Send,
  Trash2,
  Unlink,
} from "lucide-react";
import type { Player } from "../lib/types";

interface Props {
  player: Player;
  status: "joined" | "pending" | "none";
  onUnlink: (p: Player) => void;
  onRemove: (p: Player) => void;
}

/** Invite / unlink / add result / remove buttons for one roster row (coach only). */
export function RosterRowActions({
  player: p,
  status,
  onUnlink,
  onRemove,
}: Props) {
  return (
    <div className="flex items-center gap-1">
      {status === "joined" && (
        <button
          onClick={() => onUnlink(p)}
          className="btn-ghost px-2.5 py-1.5 text-slate-600"
          title={`Unlink ${p.name}'s account`}
        >
          <Unlink size={16} /> <span className="hidden lg:inline">Unlink</span>
        </button>
      )}
      <Link
        to={`/add?player=${p.id}`}
        className="btn-ghost px-2.5 py-1.5 text-court-700"
        title={`Add a result for ${p.name}`}
        aria-label={`Add a result for ${p.name}`}
      >
        <ClipboardPlus size={16} />
      </Link>
      <button
        onClick={() => onRemove(p)}
        className="btn-ghost px-2.5 py-1.5 text-red-600 hover:bg-red-50"
        aria-label={`Remove ${p.name}`}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function RosterStatus({
  status,
}: {
  status: "joined" | "pending" | "none";
}) {
  if (status === "joined")
    return <span className="font-medium text-court-700">Joined</span>;
  if (status === "pending")
    return <span className="font-medium text-amber-700">Invite sent</span>;
  return <span>Not invited</span>;
}

/**
 * Leading slot of a roster row. A claimed spot shows the player's initials;
 * an unclaimed one shows a clear Invite button instead.
 */
export function RosterLead({
  player: p,
  status,
  onInvite,
}: {
  player: Player;
  status: "joined" | "pending" | "none";
  onInvite: (p: Player) => void;
}) {
  if (status === "joined") {
    return (
      <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-court-100 text-sm font-bold text-court-800">
        {p.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
        <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-court-600 text-white ring-2 ring-white">
          <Check size={10} strokeWidth={4} />
        </span>
      </span>
    );
  }
  return status === "pending" ? (
    <button
      type="button"
      onClick={() => onInvite(p)}
      className="btn shrink-0 border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 hover:bg-amber-100"
      title={`Get ${p.name}'s invite link again`}
    >
      <Link2 size={15} /> Invite link
    </button>
  ) : (
    <button
      type="button"
      onClick={() => onInvite(p)}
      className="btn lift shrink-0 bg-ball px-3 py-2 text-court-950 shadow-sm hover:brightness-105"
      title={`Invite ${p.name} to claim this spot`}
    >
      <Send size={15} /> Invite
    </button>
  );
}
