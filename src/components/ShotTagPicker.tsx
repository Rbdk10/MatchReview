import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  Plus,
  ThumbsUp,
  TrendingDown,
  X,
} from "lucide-react";
import { SHOTS, SHOT_HINTS, TAG_SEP, joinTag } from "../lib/shotTags";
import { lockScroll } from "../lib/scrollLock";

type Tone = "good" | "bad";

const TONES: Record<
  Tone,
  {
    icon: typeof ThumbsUp;
    card: string;
    badge: string;
    chip: string;
    accent: string;
    accentSoft: string;
    ring: string;
    bar: string;
    add: string;
  }
> = {
  good: {
    icon: ThumbsUp,
    card: "border-court-200 bg-gradient-to-b from-court-50 to-white",
    badge: "bg-court-600 text-white",
    chip: "bg-white border-court-200 text-court-900",
    accent: "bg-court-600 text-white",
    accentSoft: "bg-court-50 text-court-900 border-court-300",
    ring: "ring-court-500",
    bar: "bg-court-500",
    add: "border-court-300 text-court-800 hover:bg-court-50",
  },
  bad: {
    icon: TrendingDown,
    card: "border-amber-200 bg-gradient-to-b from-amber-50 to-white",
    badge: "bg-amber-500 text-white",
    chip: "bg-white border-amber-200 text-amber-900",
    accent: "bg-amber-500 text-white",
    accentSoft: "bg-amber-50 text-amber-900 border-amber-300",
    ring: "ring-amber-400",
    bar: "bg-amber-400",
    add: "border-amber-300 text-amber-900 hover:bg-amber-50",
  },
};

/* ------------------------------------------------------------------ */
/* Card on the form                                                    */
/* ------------------------------------------------------------------ */

interface CardProps {
  tone: Tone;
  title: string;
  /** Opponent name(s) for the sheet title, e.g. "Marcus" or "the pair". */
  subject: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

/** A strengths or weaknesses card built from tapped-together shot tags. */
export function ScoutingCard({
  tone,
  title,
  subject,
  tags,
  onTagsChange,
}: CardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const t = TONES[tone];
  const Icon = t.icon;

  return (
    <div className={`rounded-2xl border p-4 ${t.card}`}>
      <div className="flex items-center gap-2">
        <span
          className={`grid size-7 place-items-center rounded-full ${t.badge}`}
        >
          <Icon size={14} strokeWidth={2.5} />
        </span>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {tags.length > 0 && (
          <span className="ml-auto text-xs font-medium text-slate-400">
            {tags.length} added
          </span>
        )}
      </div>

      {tags.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">
          Pick the shot, then narrow it down, e.g.{" "}
          <span className="whitespace-nowrap font-medium text-slate-700">
            Backhand · Slice · Low ball
          </span>
        </p>
      )}

      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag}
              className={`flex items-center gap-1 rounded-xl border py-1.5 pl-3 pr-1 text-sm font-medium shadow-sm ${t.chip} ${
                justAdded === tag ? "bounce-in" : ""
              }`}
            >
              {tag.split(TAG_SEP).map((part, i) => (
                <span
                  key={i}
                  className={i === 0 ? "font-semibold" : "text-slate-600"}
                >
                  {i > 0 && <span className="mx-1 text-slate-300">·</span>}
                  {part}
                </span>
              ))}
              <button
                type="button"
                onClick={() => onTagsChange(tags.filter((x) => x !== tag))}
                className="ml-0.5 grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={`Remove ${tag}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {tags.length === 0 ? (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold shadow-sm transition hover:brightness-105 active:scale-[.99] ${t.accent}`}
        >
          <Plus size={18} strokeWidth={3} />
          {tone === "good" ? "Tag a strength" : "Tag a weakness"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-white/60 px-4 py-3 text-sm font-semibold transition active:scale-[.99] ${t.add}`}
        >
          <Plus size={16} strokeWidth={3} /> Add another
        </button>
      )}

      {sheetOpen && (
        <ScoutingSheet
          tone={tone}
          subject={subject}
          onClose={() => setSheetOpen(false)}
          onAdd={(tag) => {
            if (!tags.includes(tag)) onTagsChange([...tags, tag]);
            setJustAdded(tag);
            setSheetOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step-by-step sheet                                                  */
/* ------------------------------------------------------------------ */

const STEP_TITLES = ["Which shot?", "What kind?", "In what situation?"];

function ScoutingSheet({
  tone,
  subject,
  onClose,
  onAdd,
}: {
  tone: Tone;
  subject: string;
  onClose: () => void;
  onAdd: (tag: string) => void;
}) {
  const [parts, setParts] = useState<string[]>([]);
  const [dir, setDir] = useState<1 | -1>(1);
  const t = TONES[tone];
  const step = parts.length;
  const shot = SHOTS.find((s) => s.shot === parts[0]);
  const stepTitle =
    step === 2 && shot?.situationTitle
      ? shot.situationTitle
      : STEP_TITLES[step];
  const options =
    step === 0
      ? SHOTS.map((s) => s.shot)
      : step === 1
        ? (shot?.types ?? [])
        : (shot?.situations ?? []);

  useEffect(() => {
    const unlockScroll = lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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

  function choose(option: string) {
    const next = [...parts, option];
    if (next.length === 3) {
      onAdd(joinTag(next));
      return;
    }
    setDir(1);
    setParts(next);
  }
  function back() {
    setDir(-1);
    setParts(parts.slice(0, -1));
  }

  const verb = tone === "good" ? "does well" : "struggles with";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={stepTitle}
    >
      <div
        className="absolute inset-0 hidden bg-slate-900/50 backdrop-blur-[2px] sm:block"
        onClick={onClose}
      />
      <div className="relative flex h-[100dvh] w-full flex-col bg-slate-50 pt-[env(safe-area-inset-top)] sm:h-auto sm:max-h-[85vh] sm:max-w-xl sm:overflow-hidden sm:rounded-3xl sm:pt-0 sm:shadow-2xl">
        {/* Header */}
        <div className="bg-white px-5 pb-4 pt-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              What {subject} {verb}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Live preview of the tag being built */}
          <div className="mt-1 flex min-h-9 flex-wrap items-center gap-1.5">
            {[0, 1, 2].map((i) =>
              parts[i] ? (
                <span
                  key={i}
                  className={`expand-in rounded-lg px-2.5 py-1 text-base font-semibold ${t.accent}`}
                >
                  {parts[i]}
                </span>
              ) : (
                <span
                  key={i}
                  className={`rounded-lg border border-dashed px-2.5 py-1 text-base ${
                    i === step
                      ? `border-slate-400 text-slate-500`
                      : "border-slate-200 text-slate-300"
                  }`}
                >
                  {["Shot", "Kind", "Situation"][i]}
                </span>
              ),
            )}
          </div>

          {/* Progress */}
          <div className="mt-4 grid grid-cols-3 gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-colors duration-300 ${i <= step ? t.bar : "bg-slate-200"}`}
              />
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div
            key={step}
            className={dir === 1 ? "slide-in-right" : "slide-in-left"}
          >
            <h2 className="text-xl font-bold text-slate-900">{stepTitle}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {step === 0
                ? "Tap one to start."
                : "Optional. Tap one, or add the tag as it is below."}
            </p>
            <div
              className={`mt-4 grid gap-2.5 ${step === 0 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}
            >
              {options.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => choose(o)}
                  className={`group flex min-h-14 flex-col justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-300 hover:shadow active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 ${t.ring}`}
                >
                  <span className="font-semibold text-slate-900">{o}</span>
                  {step === 0 && SHOT_HINTS[o] && (
                    <span className="mt-0.5 text-xs text-slate-500">
                      {SHOT_HINTS[o]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-slate-200 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          )}
          <FooterAdd
            disabled={step === 0}
            accent={t.accent}
            onClick={() => onAdd(joinTag(parts))}
          >
            {step === 0 ? "Pick a shot" : `Add “${joinTag(parts)}”`}
          </FooterAdd>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FooterAdd({
  disabled,
  accent,
  onClick,
  children,
}: {
  disabled: boolean;
  accent: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`ml-auto flex min-w-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition active:scale-[.98] disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none ${
        disabled ? "" : accent
      }`}
    >
      {!disabled && <Check size={16} strokeWidth={3} className="shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  );
}
