/** Splits text into words that rise in one after another. */
export function Words({
  text,
  step = 60,
  start = 0,
}: {
  text: string;
  step?: number;
  start?: number;
}) {
  return (
    <span className="words">
      {text.split(" ").map((w, i) => (
        <span key={i}>
          <span style={{ ["--d" as string]: `${start + i * step}ms` }}>
            {w}
          </span>
          {i < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
