/**
 * Stop the page scrolling behind a full-screen sheet. Returns the unlock function.
 *
 * Locks <html>, not <body>: html, body and #root are height: 100%, so a hidden
 * overflow on body clips the page to one screen and the browser jumps to the top.
 */
export function lockScroll(): () => void {
  const html = document.documentElement;
  const prev = html.style.overflow;
  const y = window.scrollY;
  html.style.overflow = "hidden";
  return () => {
    html.style.overflow = prev;
    // Some mobile browsers still drift while locked; put the page back where it was.
    if (window.scrollY !== y) window.scrollTo(0, y);
  };
}
