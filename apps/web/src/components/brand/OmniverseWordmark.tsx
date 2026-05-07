import * as React from 'react';

/**
 * OmniverseWordmark
 *
 * Horizontal lockup: glyph + "Omniverse" set in Inter (with a system-font
 * fallback so the wordmark still renders before the brand font loads).
 *
 * Inherits color from `currentColor`. The intrinsic aspect ratio is
 * 220:40 (5.5:1); pass either `height` or `width` and the other dimension
 * follows automatically via the SVG's intrinsic ratio.
 */
export type OmniverseWordmarkProps = Omit<React.SVGProps<SVGSVGElement>, 'viewBox'> & {
  height?: number | string;
  title?: string;
};

export function OmniverseWordmark({
  height = 32,
  title = 'Omniverse',
  ...rest
}: OmniverseWordmarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 220 40"
      height={height}
      role="img"
      aria-label={title}
      {...rest}
    >
      <title>{title}</title>
      <g fill="none">
        <circle cx="20" cy="20" r="13" stroke="currentColor" strokeWidth="2.6" />
        <circle cx="29.4" cy="10.6" r="3.4" fill="currentColor" />
      </g>
      <text
        x="48"
        y="27"
        fontFamily="Inter, 'Inter var', system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="-0.4"
        fill="currentColor"
      >
        Omniverse
      </text>
    </svg>
  );
}

export default OmniverseWordmark;
