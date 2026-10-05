import { useEffect, useRef, useState } from "react";

/** Animates from 0 to `value` when it first becomes visible. */
export function CountUp({
  value,
  suffix = "",
  duration = 900,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = () => {
      if (started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(Math.round(value * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      io.disconnect();
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) start();
    });
    io.observe(el);
    // Failsafe: if the observer never fires (background tab, odd layouts), show the number anyway.
    const fallback = window.setTimeout(() => {
      if (!started.current) {
        started.current = true;
        setShown(value);
        io.disconnect();
      }
    }, 1500);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [value, duration]);

  return (
    <span ref={ref}>
      {shown}
      {suffix}
    </span>
  );
}
