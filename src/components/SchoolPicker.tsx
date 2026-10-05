import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, School as SchoolIcon, Search, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { lockScroll } from "../lib/scrollLock";

export interface School {
  id: number;
  name: string;
  acronym: string;
  domain: string | null;
}

interface Props {
  value: School | null;
  onChange: (school: School | null) => void;
  placeholder?: string;
  /** Shows a clear button when a school is selected. */
  optional?: boolean;
  /** Styling for dark backgrounds (onboarding). */
  dark?: boolean;
  id?: string;
}

/** Opens a searchable list of US schools. Schools can only be chosen from this list. */
export function SchoolPicker({
  value,
  onChange,
  placeholder = "Choose a school",
  optional,
  dark,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex gap-2">
        <button
          id={id}
          type="button"
          onClick={() => setOpen(true)}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left transition ${
            dark
              ? "border-white/20 bg-white/10 text-white hover:border-white/40"
              : "border-slate-300 bg-white text-slate-900 shadow-sm hover:border-court-500"
          }`}
        >
          <SchoolIcon
            size={18}
            className={`shrink-0 ${dark ? "text-ball" : "text-court-600"}`}
          />
          <span className="min-w-0 flex-1">
            {value ? (
              <span className="block truncate font-medium">{value.name}</span>
            ) : (
              <span className={dark ? "text-white/50" : "text-slate-400"}>
                {placeholder}
              </span>
            )}
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 ${dark ? "text-white/50" : "text-slate-400"}`}
          />
        </button>
        {optional && value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="btn-ghost shrink-0 px-2 text-slate-500"
            aria-label="Clear school"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {open && (
        <SchoolSearchModal
          onClose={() => setOpen(false)}
          onPick={(s) => {
            onChange(s);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function SchoolSearchModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (s: School) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<School[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unlockScroll = lockScroll();
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Don't let a modal underneath close as well.
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      unlockScroll();
    };
  }, [onClose]);

  useEffect(() => {
    const term = q.replace(/[,()%*\\]/g, " ").trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      const { data } = await supabase
        .from("schools")
        .select("id, name, acronym, domain")
        .or(`name.ilike.%${term}%,acronym.ilike.${term}%`)
        .limit(60);
      const lower = term.toLowerCase();
      const rank = (s: School) =>
        s.acronym.toLowerCase() === lower
          ? 0
          : s.name.toLowerCase().startsWith(lower)
            ? 1
            : s.acronym.toLowerCase().startsWith(lower)
              ? 2
              : 3;
      setResults(
        ((data as School[]) ?? []).sort(
          (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name),
        ),
      );
      setActive(0);
      setSearching(false);
    }, 180);
    return () => window.clearTimeout(t);
  }, [q]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a school"
    >
      <div
        className="absolute inset-0 hidden bg-slate-900/50 backdrop-blur-[2px] sm:block"
        onClick={onClose}
      />
      <div className="relative flex h-[100dvh] w-full flex-col bg-white pt-[env(safe-area-inset-top)] sm:h-auto sm:max-h-[80vh] sm:max-w-lg sm:rounded-2xl sm:pt-0 sm:shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 sm:border-0 sm:px-5 sm:pt-5">
          <div className="relative flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="input pl-10"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && results[active]) {
                  e.preventDefault();
                  onPick(results[active]);
                }
              }}
              placeholder="Search schools, e.g. Montana State"
              aria-label="Search schools"
            />
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-court-700 sm:hidden"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="hidden rounded-lg p-1 text-slate-500 hover:bg-slate-100 sm:block"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-40 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:pt-3">
          {q.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              Type at least two letters to search US schools.
            </p>
          ) : searching && results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              No schools match “{q.trim()}”.
            </p>
          ) : (
            <ul role="listbox" aria-label="Schools">
              {results.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => onPick(s)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left active:bg-court-100 ${
                      i === active ? "bg-court-50" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">
                        {s.name}
                      </span>
                      {s.domain && (
                        <span className="block truncate text-xs text-slate-400">
                          {s.domain}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">
                      {s.acronym}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Builds a School value from a profile's stored school. */
export function schoolFromProfile(
  p: { school_id?: number | null; team_name?: string | null } | null,
): School | null {
  return p?.school_id && p.team_name
    ? { id: p.school_id, name: p.team_name, acronym: "", domain: null }
    : null;
}
