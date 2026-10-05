import { useEffect } from "react";

/**
 * Scroll-driven reveal. Any element with `data-reveal` inside `root` gets the
 * `in` class once it enters the viewport. Watches the DOM so route changes and
 * async-loaded content are picked up automatically.
 */
export function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    const seen = new WeakSet<Element>();
    const scan = () => {
      el.querySelectorAll<HTMLElement>("[data-reveal]").forEach((node) => {
        if (seen.has(node)) return;
        seen.add(node);
        if (reduced) node.classList.add("in");
        else io.observe(node);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(el, { childList: true, subtree: true });
    // Safety net: never leave content hidden if the observer is slow or the tab is backgrounded.
    const failsafe = window.setInterval(() => {
      el.querySelectorAll<HTMLElement>("[data-reveal]:not(.in)").forEach(
        (node) => {
          if (node.getBoundingClientRect().top < window.innerHeight * 1.5)
            node.classList.add("in");
        },
      );
    }, 1500);
    return () => {
      io.disconnect();
      mo.disconnect();
      window.clearInterval(failsafe);
    };
  }, [root]);
}
