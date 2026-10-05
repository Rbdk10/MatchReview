// Remembers an invite the visitor opened, so signing in (or wandering off) still lands them back on it.
const KEY = "mr-pending-invite";

export function rememberInvite(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* storage unavailable */
  }
}
export function pendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function forgetInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
export function inviteLink(token: string): string {
  return `${window.location.origin}/join/${token}`;
}
