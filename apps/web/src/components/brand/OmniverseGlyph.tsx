import * as React from 'react';

/**
 * OmniverseGlyph
 *
 * Square mark: a stroked ring (the "omni") with a single offset solid
 * node (a "verse"). Inherits color from `currentColor`, so wrap it in a
 * Tailwind `text-omniverse-orbit` (or any color utility) to tint it.
 *
 * Size defaults to 1em so it composes naturally inside text runs.
 */
export type OmniverseGlyphProps = Omit<React.SVGProps<SVGSVGElement>, 'viewBox'> & {
  size?: number | string;
  title?: string;
};

export function OmniverseGlyph({
  size = '1em',
  title = 'Omniverse',
  ...rest
}: OmniverseGlyphProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label={title}
      {...rest}
    >
      <title>{title}</title>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="18.6" cy="5.4" r="2.4" fill="currentColor" />
    </svg>
  );
}

export default OmniverseGlyph;
