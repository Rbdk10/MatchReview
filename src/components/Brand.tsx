/** WhosMyOpponent brand: the mark (you | them bars) and the wordmark. The coloured half is the sport accent. */

// The mark on a 32-unit grid, slanted 18° like the italic wordmark.
const US = [
  [5.25, 8, 9],
  [9.25, 14, 5],
  [6.25, 20, 8],
] as const;
const THEM = [
  [17.75, 8, 6],
  [17.75, 14, 10],
  [17.75, 20, 4],
] as const;

/** The mark alone. `tile` puts it on the white rounded app-icon square. */
export function BrandMark({
  className = "size-9",
  onDark = false,
  tile = false,
}: {
  className?: string;
  onDark?: boolean;
  tile?: boolean;
}) {
  // Bare on a dark background the bars flip to white and the lighter blue.
  const bare = onDark && !tile;
  const ink = bare ? "#ffffff" : "var(--color-ink)";
  const accent = bare ? "var(--color-sport-light)" : "var(--color-sport)";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {tile && <rect width="32" height="32" rx="7" fill="#ffffff" />}
      <g transform="translate(16 16) skewX(-18) translate(-16 -16)">
        {US.map(([x, y, w]) => (
          <rect key={y} x={x} y={y} width={w} height="4" fill={ink} />
        ))}
        <rect x="15.25" y="7" width="1.5" height="18" fill={ink} />
        {THEM.map(([x, y, w]) => (
          <rect key={y} x={x} y={y} width={w} height="4" fill={accent} />
        ))}
      </g>
    </svg>
  );
}

/** "WhosMyOpponent", with the second half in the sport colour. Size it with a text-* class. */
export function Wordmark({
  className = "text-2xl",
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span
      className={`whitespace-nowrap font-logo ${onDark ? "logo-pop-dark" : "logo-pop"} ${className}`}
    >
      <span className={onDark ? "text-white" : "text-ink"}>WhosMy</span>
      <span className={onDark ? "text-sport-light" : "text-sport"}>
        Opponent
      </span>
    </span>
  );
}

/** Mark + wordmark side by side, for headers. */
export function BrandLockup({
  onDark = false,
  size = "md",
}: {
  onDark?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const s = {
    sm: { mark: "size-8", text: "text-xl", gap: "gap-2" },
    md: { mark: "size-9", text: "text-[22px]", gap: "gap-2.5" },
    lg: { mark: "size-14", text: "text-4xl md:text-5xl", gap: "gap-3" },
  }[size];
  return (
    <div className={`flex min-w-0 items-center ${s.gap}`}>
      <BrandMark tile className={`${s.mark} shrink-0 rounded-[22%] shadow-sm ${onDark ? "" : "ring-1 ring-black/10"}`} />
      <Wordmark onDark={onDark} className={s.text} />
    </div>
  );
}
