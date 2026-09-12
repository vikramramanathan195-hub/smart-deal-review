import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animates a number toward its latest value with an ease-out curve, instead
 * of letting it snap — used only for prominent summary figures (deal
 * totals, portfolio stats), not every number on the page, so motion reads as
 * a highlight rather than noise. Jumps straight to the value when the OS
 * requests reduced motion, or on first mount (nothing to animate from). */
export function useCountUp(value: number, durationMs = 600): number {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const mountedRef = useRef(false);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;

    if (!mountedRef.current || from === to || prefersReducedMotion()) {
      mountedRef.current = true;
      prevRef.current = to;
      setDisplay(to);
      return;
    }

    let raf: number;
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const progress = Math.min((t - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prevRef.current = to;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return display;
}
