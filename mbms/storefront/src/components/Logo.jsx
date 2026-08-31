import React from 'react';

/**
 * Morise brand mark.
 *
 * Concept: a geometric monoline "M" that also reads as an upward growth line and
 * a route/path between points; the amber apex diamond is the holding company as
 * the connecting keystone of its subsidiaries.
 *
 * The "M" stroke uses `currentColor`, so it inherits the text colour of whatever
 * tile/badge it sits inside (navy on white, white on navy). The apex diamond is
 * always Morise amber (#D97706). Pass `tile` for the standalone navy app-tile
 * version (favicons, splash) and `tone` to override the stroke colour.
 *
 * Colours: navy #1E3A5F · amber #D97706 · white #FFFFFF
 */
export default function Logo({
  size = 32,
  tile = false,
  tone,
  title = 'Morise',
  className,
  ...rest
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 128 128',
    role: 'img',
    'aria-label': title,
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    ...rest,
  };

  const mStroke = tile ? '#FFFFFF' : tone || 'currentColor';

  return (
    <svg {...common}>
      <title>{title}</title>
      {tile && <rect x="4" y="4" width="120" height="120" rx="28" fill="#1E3A5F" />}
      <path
        d="M32 94 V40 L64 74 L96 40 V94"
        fill="none"
        stroke={mStroke}
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M64 20 L77 33 L64 46 L51 33 Z" fill="#D97706" />
    </svg>
  );
}
