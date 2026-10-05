import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ConfirmModal } from "./Modal";

/** Permanently deletes the signed-in account (required by the App Store for apps with sign-up). */
export function DeleteAccount() {
  const { canManageTeam, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownsTeam = canManageTeam && !isAdmin;

  async function remove() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    await signOut();
  }

  return (
    <>
      <button
        className="btn-ghost text-red-600 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        Delete account
      </button>
      <ConfirmModal
        open={open}
        title="Delete your account?"
        danger
        busy={busy}
        confirmLabel="Delete forever"
        onCancel={() => setOpen(false)}
        onConfirm={remove}
        message={
          <>
            <p>
              {ownsTeam
                ? "This permanently deletes your account and your whole team: players, staff, opponents, results and notes. Players and staff you invited lose access."
                : "This permanently deletes your account. Your coach keeps your spot on the team and the results already logged."}
            </p>
            <p className="mt-2 font-medium text-slate-800">
              This can&apos;t be undone.
            </p>
            {error && <p className="mt-2 text-red-700">{error}</p>}
          </>
        }
      />
    </>
  );
}
