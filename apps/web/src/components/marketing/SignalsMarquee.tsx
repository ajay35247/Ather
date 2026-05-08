'use client';

/**
 * SignalsMarquee
 *
 * A continuously-scrolling row of "live signals" that gives the marketing
 * surface a sense of *aliveness* without faking real-time data. Items are
 * static strings supplied by the parent. The marquee pauses on hover and is
 * frozen entirely under prefers-reduced-motion (via globals.css killswitch).
 *
 * Implementation notes:
 *   - We render the children twice back-to-back so the linear -50% translate
 *     in `@keyframes marquee` produces a seamless loop with zero JS.
 *   - `aria-hidden` on the duplicate prevents screen readers from reading
 *     each signal twice.
 */
export function SignalsMarquee({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="relative w-full overflow-hidden border-y border-white/10 bg-white/[0.02] py-3">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10"
        style={{ background: 'linear-gradient(90deg, rgb(2 6 23) 0%, transparent 100%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10"
        style={{ background: 'linear-gradient(-90deg, rgb(2 6 23) 0%, transparent 100%)' }}
      />
      <div className="marquee gap-10 px-6 text-xs sm:text-sm text-gray-300">
        <SignalRow items={items} />
        <SignalRow items={items} ariaHidden />
      </div>
    </div>
  );
}

function SignalRow({ items, ariaHidden = false }: { items: string[]; ariaHidden?: boolean }) {
  return (
    <ul
      className="flex shrink-0 items-center gap-10"
      aria-hidden={ariaHidden || undefined}
      role={ariaHidden ? 'presentation' : 'list'}
    >
      {items.map((s, i) => (
        <li key={`${i}-${s}`} className="flex items-center gap-2 whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-glow-mint" />
          <span className="font-medium tracking-wide">{s}</span>
        </li>
      ))}
    </ul>
  );
}
