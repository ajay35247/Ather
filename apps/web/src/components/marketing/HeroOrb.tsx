/**
 * HeroOrb
 *
 * A layered, CSS-only "spatial" orb. Three nested rings + a chromatic core +
 * three orbiting particles. GPU-friendly (transform + opacity), no canvas.
 * Disable-on-reduced-motion handled globally via globals.css.
 */
export function HeroOrb({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative h-72 w-72 sm:h-96 sm:w-96 ${className}`}
    >
      {/* Outer halo */}
      <div className="absolute inset-0 rounded-full blur-3xl opacity-80"
           style={{
             background:
               'conic-gradient(from 90deg, rgb(249 115 22 / 0.55), rgb(251 191 36 / 0.40), rgb(16 185 129 / 0.35), rgb(99 102 241 / 0.55), rgb(249 115 22 / 0.55))',
           }} />

      {/* Concentric rings */}
      <div className="absolute inset-6 rounded-full border border-white/15" />
      <div className="absolute inset-12 rounded-full border border-white/10" />
      <div className="absolute inset-20 rounded-full border border-white/8" />

      {/* Chromatic core */}
      <div
        className="absolute inset-[28%] rounded-full shadow-glow-warm animate-pulse-slow"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgb(255 237 213), rgb(249 115 22) 45%, rgb(154 52 18) 100%)',
        }}
      />

      {/* Orbiting particles (offset via float-soft + animation-delay) */}
      <span
        className="absolute left-[8%] top-[42%] h-2.5 w-2.5 rounded-full bg-amber-300 shadow-glow-warm float-soft"
        style={{ animationDelay: '0s' }}
      />
      <span
        className="absolute right-[6%] top-[28%] h-2 w-2 rounded-full bg-emerald-300 shadow-glow-mint float-soft"
        style={{ animationDelay: '-2.5s' }}
      />
      <span
        className="absolute right-[18%] bottom-[12%] h-1.5 w-1.5 rounded-full bg-indigo-300 shadow-glow-cool float-soft"
        style={{ animationDelay: '-5s' }}
      />
    </div>
  );
}
