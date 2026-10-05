import { useState } from "react";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import { SHOTS, joinTag } from "../lib/shotTags";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  tone: "good" | "bad";
  /** Accessible name, e.g. "Did well tags". */
  label: string;
}

const STEPS = ["Shot", "Type", "Situation"] as const;

/** Three-step tag builder: Shot -> Type -> Situation. Type and situation are optional. */
export function ShotTagPicker({ value, onChange, tone, label }: Props) {
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState<string[]>([]);

  const good = tone === "good";
  const chipCls = good
    ? "border-court-200 bg-court-50 text-court-900"
    : "border-amber-200 bg-amber-50 text-amber-900";
  const accent = good
    ? "bg-court-600 text-white border-court-600"
    : "bg-amber-500 text-white border-amber-500";

  const step = parts.length; // 0 shot, 1 type, 2 situation
  const shot = SHOTS.find((s) => s.shot === parts[0]);
  const options =
    step === 0
      ? SHOTS.map((s) => s.shot)
      : step === 1
        ? (shot?.types ?? [])
        : (shot?.situations ?? []);

  function reset() {
    setParts([]);
    setOpen(false);
  }
  function commit(next: string[]) {
    const tag = joinTag(next);
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    reset();
  }
  function pick(option: string) {
    const next = [...parts, option];
    if (next.length === 3) commit(next);
    else setParts(next);
  }

  return (
    <div aria-label={label}>
      {/* Selected tags */}
      <div className="flex flex-wrap gap-2">
        {value.map((t) => (
          <span
            key={t}
            className={`flex items-center gap-1 rounded-full border py-1 pl-3 pr-1 text-sm font-medium ${chipCls}`}
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="grid size-6 place-items-center rounded-full opacity-60 hover:bg-black/5 hover:opacity-100"
              aria-label={`Remove ${t}`}
            >
              <X size={13} />
            </button>
          </span>
        ))}
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800"
          >
            <Plus size={14} /> Add tag
          </button>
        )}
      </div>

      {/* Builder */}
      {open && (
        <div className="expand-in mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <ol className="flex items-center gap-1.5 text-xs font-semibold">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  className={`rounded-full px-2.5 py-1 ${i === step ? accent : i < step ? "bg-slate-200 text-slate-700" : "text-slate-400"}`}
                >
                  {i + 1}. {i < step ? parts[i] : s}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              aria-label="Cancel tag"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => pick(o)}
                className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 active:scale-[.97]"
              >
                {o}
              </button>
            ))}
          </div>

          {step > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setParts(parts.slice(0, -1))}
                className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="button"
                onClick={() => commit(parts)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${accent}`}
              >
                <Check size={14} strokeWidth={3} /> Add “{joinTag(parts)}”
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
