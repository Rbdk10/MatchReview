import { useEffect, useRef } from "react";
import { useReveal } from "../lib/useReveal";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Plus, School, Users, UserCircle, LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import { staffRoleLabel } from "../lib/types";
import { AdminBar } from "./AdminBar";
import { tapFeedback } from "../lib/nativeUi";
import { teamShortName } from "../lib/types";
import { BrandLockup } from "./Brand";

/** The team tab is named after the team itself, e.g. "MSU". */
function teamLabel(name?: string | null) {
  return teamShortName(name);
}

export function Layout() {
  const { profile, staff, signOut } = useAuth();
  const team = teamLabel(profile?.team_name);
  const navItems = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/team", label: team, icon: School, end: false },
    { to: "/opponents", label: "Opponents", icon: Users, end: false },
    { to: "/profile", label: "Profile", icon: UserCircle, end: false },
  ];
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  useReveal(mainRef);

  // Keyboard shortcut: press "n" anywhere (outside inputs) to add a result.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (typing || target?.isContentEditable) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        navigate("/add");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-underline flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:translate-x-1 ${
      isActive
        ? "bg-court-700 text-white"
        : "text-slate-300 hover:bg-court-800/70 hover:text-white"
    }`;

  return (
    <div className="flex min-h-full" data-sport={profile?.sport ?? "tennis"}>
      {/* Desktop sidebar */}
      <aside className="relative hidden w-64 shrink-0 flex-col overflow-hidden bg-court-900 p-4 text-white md:flex md:sticky md:top-0 md:h-screen">
        <div className="aurora aurora-sm opacity-60" aria-hidden="true" />
        <div className="relative">
          <BrandLockup onDark size="sm" />
        </div>
        <NavLink
          to="/add"
          className={({ isActive }) =>
            `pulse-ring lift relative mt-6 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-bold shadow-lg transition ${
              isActive
                ? "bg-ball text-court-950"
                : "bg-ball text-court-950 hover:brightness-105"
            }`
          }
        >
          <Plus size={20} strokeWidth={3} /> Add result
        </NavLink>
        <p className="relative mt-1.5 text-center text-[11px] text-slate-400">
          or press <kbd className="rounded bg-court-800 px-1 font-mono">n</kbd>
        </p>
        <nav className="relative mt-6 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={linkClass}
              title={item.label}
            >
              <item.icon size={18} className="shrink-0" />{" "}
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="relative mt-auto">
          <AdminBar />
        </div>
        <div className="relative mt-4 border-t border-court-800 pt-4">
          <p className="truncate text-sm font-medium">
            {profile?.full_name || staff?.name || "Coach"}
          </p>
          <p className="truncate text-xs text-slate-400">
            <span className="capitalize">
              {staff ? staffRoleLabel(staff.role) : (profile?.role ?? "coach")}
            </span>
            {profile?.team_name ? ` · ${profile.team_name}` : ""}
          </p>
          <button
            onClick={signOut}
            className="mt-3 flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur md:hidden">
          <BrandLockup size="sm" />
          <NavLink
            to="/add"
            className="btn lift bg-court-600 px-3 py-2 text-white"
          >
            <Plus size={18} strokeWidth={3} /> Result
          </NavLink>
        </header>
        <div className="md:hidden">
          <AdminBar compact />
        </div>

        <main
          ref={mainRef}
          className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8"
        >
          <Outlet />
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur keyboard-open:hidden md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
            <MobileTab to="/" end label="Home" icon={Home} />
            <MobileTab to="/team" label={team} icon={School} />
            <NavLink
              to="/add"
              onClick={tapFeedback}
              className="-mt-6 flex flex-col items-center justify-center pb-2 text-[11px] font-semibold text-court-700"
              aria-label="Add result"
            >
              <span className="pulse-ring grid size-14 place-items-center rounded-full bg-ball text-court-950 shadow-lg ring-4 ring-white">
                <Plus size={28} strokeWidth={3} />
              </span>
              Add
            </NavLink>
            <MobileTab to="/opponents" label="Opponents" icon={Users} />
            <MobileTab to="/profile" label="Profile" icon={UserCircle} />
          </div>
        </nav>
      </div>
    </div>
  );
}

function MobileTab({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={tapFeedback}
      className={({ isActive }) =>
        `flex min-w-0 flex-col items-center gap-1 py-2 text-[11px] font-medium ${
          isActive ? "text-court-700" : "text-slate-500"
        }`
      }
    >
      <Icon size={22} />
      <span className="max-w-full truncate px-1">{label}</span>
    </NavLink>
  );
}
