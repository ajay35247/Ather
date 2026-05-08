/**
 * AuroraBackground
 *
 * A cinematic, depth-layered background for the public marketing surface.
 * Pure CSS — no canvas, no WebGL, no JS animation loop. Uses three layers:
 *
 *   1. A radial "aurora" sweep that slowly pans (`aurora-sweep`)
 *   2. A static, very-low-opacity dot grid for spatial reference
 *   3. A vignette to deepen edges and let content breathe in the center
 *
 * Honors `prefers-reduced-motion` via the global killswitch in globals.css.
 * Pointer-events disabled and aria-hidden — purely decorative.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Layer 1 — slow-panning aurora sweep */}
      <div className="absolute inset-[-20%] aurora-sweep">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background: [
              // saffron orbit, top-right
              'radial-gradient(38rem 38rem at 78% 18%, rgb(249 115 22 / 0.28), transparent 60%)',
              // mint orbit, bottom-left
              'radial-gradient(36rem 36rem at 18% 82%, rgb(16 185 129 / 0.22), transparent 60%)',
              // indigo halo, center
              'radial-gradient(56rem 56rem at 50% 50%, rgb(99 102 241 / 0.18), transparent 65%)',
            ].join(','),
          }}
        />
      </div>

      {/* Layer 2 — dot grid for spatial reference */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(rgb(255 255 255 / 0.35) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage:
            'radial-gradient(60% 60% at 50% 40%, #000 30%, transparent 90%)',
          WebkitMaskImage:
            'radial-gradient(60% 60% at 50% 40%, #000 30%, transparent 90%)',
        }}
      />

      {/* Layer 3 — vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, transparent 50%, rgb(2 6 23 / 0.55) 100%)',
        }}
      />
    </div>
  );
}
