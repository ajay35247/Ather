/**
 * Reusable spotlight/tilt mouse handler.
 *
 * Returns an `onMouseMove` for a card-style element that writes the
 * normalized (0..1) cursor position to `--mx` / `--my` CSS custom properties
 * so the element's `.spotlight` / `.tilt` styles can react in pure CSS.
 *
 * Implementation notes:
 *   - The DOM write is rAF-batched. Native mousemove can fire well above
 *     the display refresh rate; without batching, every pixel of pointer
 *     travel triggers a layout read (`getBoundingClientRect`) + style
 *     mutation. With rAF we coalesce to one read+write per frame.
 *   - We capture clientX/Y synchronously inside the handler (the React
 *     synthetic event object is pooled / nullable by the time the rAF
 *     callback runs).
 *   - Honors `prefers-reduced-motion`: returns a no-op handler so motion
 *     stays off for users who asked for it.
 */
import { useMemo, useRef } from 'react';

export function useSpotlight() {
  const frame = useRef<number | null>(null);

  return useMemo(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce) return () => {};

    return (e: React.MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const cx = e.clientX;
      const cy = e.clientY;

      if (frame.current !== null) return; // already a frame queued
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        el.style.setProperty('--mx', String((cx - r.left) / r.width));
        el.style.setProperty('--my', String((cy - r.top) / r.height));
      });
    };
  }, []);
}
