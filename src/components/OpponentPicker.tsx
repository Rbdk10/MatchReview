import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, School as SchoolIcon, UserPlus, X } from "lucide-react";
import { formatPersonName, type Opponent } from "../lib/types";
import { SchoolPicker, type School } from "./SchoolPicker";

export type OpponentChoice =
  | { kind: "existing"; opponent: Opponent }
  | { kind: "new"; name: string; school: School | null };

interface Props {
  label: string;
  opponents: Opponent[];
  value: OpponentChoice | null;
  onChange: (next: OpponentChoice | null) => void;
  /** Opponent ids already picked elsewhere on the form, hidden from the list. */
  exclude?: string[];
  placeholder?: string;
  optional?: boolean;
}

export function OpponentPicker({
  label,
  opponents,
  value,
  onChange,
  exclude = [],
  placeholder,
  optional,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const available = useMemo(
    () => opponents.filter((o) => !exclude.includes(o.id)),
    [opponents, exclude],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.school ?? "").toLowerCase().includes(q),
    );
  }, [query, available]);
  const exact = useMemo(
    () =>
      available.find(
        (o) => o.name.trim().toLowerCase() === query.trim().toLowerCase(),
      ),
    [query, available],
  );

  function pickExisting(o: Opponent) {
    onChange({ kind: "existing", opponent: o });
    setOpen(false);
  }
  function pickNew() {
    const name = formatPersonName(query);
    if (!name) return;
    onChange({ kind: "new", name, school: null });
    setOpen(false);
  }
  function clear() {
    onChange(null);
    setQuery("");
  }

  return (
    <div>
      <p className="label">
        {label}{" "}
        {optional && (
          <span className="font-normal text-slate-400">(optional)</span>
        )}
      </p>
      {value ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-court-200 bg-court-50 p-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-court-900">
              {value.kind === "existing" ? value.opponent.name : value.name}
              {value.kind === "new" && (
                <span className="ml-2 rounded-full bg-court-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                  New
                </span>
              )}
            </p>
            {value.kind === "existing" ? (
              <p className="text-sm text-court-800/80">
                {value.opponent.school || "No school recorded"}
              </p>
            ) : (
              <div className="mt-2">
                <label className="label text-court-900">
                  <SchoolIcon size={14} className="mr-1 inline" /> School they play
                  for{" "}
                  <span className="font-normal text-court-800/60">
                    (optional)
                  </span>
                </label>
                <SchoolPicker
                  value={value.school}
                  onChange={(school) => onChange({ ...value, school })}
                  placeholder="Search US schools"
                  optional
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={clear}
            className="btn-ghost shrink-0 px-2 py-1 text-slate-500"
          >
            <X size={16} /> Change
          </button>
        </div>
      ) : (
        <div ref={ref} className="relative">
          <input
            className="input pr-10"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (exact) pickExisting(exact);
                else pickNew();
              }
            }}
            placeholder={
              placeholder ?? "Search registered opponents or type a new name"
            }
            aria-label={label}
            autoComplete="off"
          />
          <ChevronDown
            size={18}
            className="pointer-events-none absolute right-3 top-3 text-slate-400"
          />
          {open && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pickExisting(o)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium">{o.name}</span>
                  {o.school && (
                    <span className="text-xs text-slate-500">{o.school}</span>
                  )}
                </button>
              ))}
              {query.trim() && !exact && (
                <button
                  type="button"
                  onClick={pickNew}
                  className="flex w-full items-center gap-2 border-t border-slate-100 px-3.5 py-2.5 text-left text-sm font-semibold text-court-700 hover:bg-court-50"
                >
                  <UserPlus size={16} /> Add “{formatPersonName(query)}” as a new opponent
                </button>
              )}
              {filtered.length === 0 && !query.trim() && (
                <p className="px-3.5 py-2.5 text-sm text-slate-500">
                  No opponents yet. Type a name to add one.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
