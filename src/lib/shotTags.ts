// Vocabulary for structured scouting tags: Shot -> Type -> Situation.
// A tag is stored as its parts joined with " · ", e.g. "Backhand · Volley · Low ball".

export const TAG_SEP = " · ";

const GROUNDSTROKE_TYPES = [
  "Groundstroke",
  "Topspin",
  "Slice",
  "Volley",
  "Half-volley",
  "Approach",
  "Passing shot",
  "Drop shot",
  "Lob",
  "Return",
];
const STROKE_SITUATIONS = [
  "High ball",
  "Low ball",
  "Wide ball",
  "Short ball",
  "Deep ball",
  "On the run",
  "Body shot",
  "Cross-court",
  "Down the line",
  "Under pressure",
];

export const SHOTS: { shot: string; types: string[]; situations: string[] }[] =
  [
    {
      shot: "Forehand",
      types: GROUNDSTROKE_TYPES,
      situations: STROKE_SITUATIONS,
    },
    {
      shot: "Backhand",
      types: GROUNDSTROKE_TYPES,
      situations: STROKE_SITUATIONS,
    },
    {
      shot: "Serve",
      types: ["First serve", "Second serve", "Flat", "Kick", "Slice"],
      situations: [
        "Deuce side",
        "Ad side",
        "Out wide",
        "Body",
        "Down the T",
        "Big points",
      ],
    },
    {
      shot: "Return",
      types: [
        "Vs first serve",
        "Vs second serve",
        "Chip / block",
        "Aggressive",
      ],
      situations: [
        "Deuce side",
        "Ad side",
        "Wide serve",
        "Body serve",
        "Kick serve",
        "Big points",
      ],
    },
    {
      shot: "Net play",
      types: ["Volley", "Half-volley", "Overhead", "Poaching", "Positioning"],
      situations: [
        "High ball",
        "Low ball",
        "Wide ball",
        "Lob over them",
        "Passing shot",
        "At the body",
      ],
    },
    {
      shot: "Movement",
      types: ["Lateral", "Forward", "Backward", "Recovery", "Footwork"],
      situations: [
        "Wide ball",
        "Short ball",
        "Deep ball",
        "Long rallies",
        "Change of pace",
      ],
    },
    {
      shot: "Mental",
      types: [
        "Consistency",
        "Patience",
        "Composure",
        "Focus",
        "Shot selection",
      ],
      situations: [
        "Big points",
        "Long rallies",
        "When behind",
        "When ahead",
        "Tiebreaks",
      ],
    },
  ];

export function joinTag(parts: string[]): string {
  return parts.filter(Boolean).join(TAG_SEP);
}

/** Counts tags across results, most frequent first. */
export function tallyTags(
  lists: (string[] | null | undefined)[],
): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const list of lists)
    for (const t of list ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** One-line descriptions shown on the shot tiles. */
export const SHOT_HINTS: Record<string, string> = {
  Forehand: "Groundstrokes, volleys, specialty shots",
  Backhand: "Groundstrokes, volleys, specialty shots",
  Serve: "First and second serves, placement",
  Return: "Returning first and second serves",
  "Net play": "Volleys, overheads, poaching",
  Movement: "Footwork, court coverage, recovery",
  Mental: "Composure, patience, decision making",
};

/** Human phrasing of a stored tag for previews, e.g. "Backhand volley on low balls". */
export function describeTag(parts: string[]): string {
  const [shot, type, situation] = parts;
  if (!shot) return "";
  let text = type ? `${shot} ${type.toLowerCase()}` : shot;
  if (situation) text += ` · ${situation.toLowerCase()}`;
  return text;
}
