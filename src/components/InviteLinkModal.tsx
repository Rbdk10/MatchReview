import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, RefreshCw, Share2 } from "lucide-react";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  title: string;
  message: ReactNode;
  /** Empty while the link is being created. */
  url: string;
  shareText: string;
  onRegenerate: () => void;
  onClose: () => void;
}

/** One-time invite link with copy / share / new-link buttons. */
export function InviteLinkModal({
  open,
  title,
  message,
  url,
  shareText,
  onRegenerate,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCopied(false);
    setError(null);
  }, [open, url]);

  async function copyLink() {
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

  async function shareLink() {
    try {
      await navigator.share({
        title: "Join our team on MatchReview",
        text: shareText,
        url,
      });
    } catch {
      /* share sheet dismissed */
    }
  }

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-slate-600">{message}</p>
      {!url ? (
        <p className="mt-4 text-sm text-slate-500">Creating link…</p>
      ) : (
        <>
          <input
            className="input mt-4 font-mono text-xs"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Invite link"
          />
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="btn-ghost text-slate-500" onClick={onRegenerate}>
              <RefreshCw size={15} /> New link
            </button>
            {canShare && (
              <button className="btn-secondary" onClick={shareLink}>
                <Share2 size={15} /> Share
              </button>
            )}
            <button className="btn-primary" onClick={copyLink}>
              {copied ? <Check size={15} strokeWidth={3} /> : <Copy size={15} />}{" "}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
