import React from 'react';

interface HourglassSvgProps {
  remainingRatio: number; // 1 = full top, 0 = empty top
  isOvertime: boolean;
  isActiveParticipant: boolean;
  isPaused: boolean;
  sizeClass?: string;
}

export const HourglassSvg: React.FC<HourglassSvgProps> = ({
  remainingRatio,
  isOvertime,
  isActiveParticipant,
  isPaused,
  sizeClass = 'h-14 w-14 sm:h-20 sm:w-20',
}) => {
  const clamped = isActiveParticipant ? Math.max(0, Math.min(1, remainingRatio)) : 0.65;
  const filledBottomRatio = isActiveParticipant ? 1 - clamped : 0.35;

  const sandColor = !isActiveParticipant
    ? '#B5AEA0'
    : isOvertime
      ? '#C86D51'
      : '#8A9A5B';

  const frameColor = !isActiveParticipant
    ? '#A79F91'
    : isOvertime
      ? '#B45E44'
      : '#5E6B3B';

  // Upper bulb y range: 16..46 (height 30)
  const topHeight = 28 * clamped;
  const topY = 46 - topHeight;

  // Lower bulb y range: 54..84 (height 30)
  const bottomHeight = 28 * filledBottomRatio;
  const bottomY = 84 - bottomHeight;

  const streamActive = isActiveParticipant && !isPaused && clamped > 0;

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${sizeClass} select-none transition-colors duration-300`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id="hg-top-bulb">
          <path d="M26 16 H74 C74 34 55 44 50 48 C45 44 26 34 26 16 Z" />
        </clipPath>
        <clipPath id="hg-bottom-bulb">
          <path d="M50 52 C55 56 74 66 74 84 H26 C26 66 45 56 50 52 Z" />
        </clipPath>
      </defs>

      {/* Glass background */}
      <path
        d="M26 16 H74 C74 34 55 44 50 48 C45 44 26 34 26 16 Z"
        fill="#FAF8F5"
      />
      <path
        d="M50 52 C55 56 74 66 74 84 H26 C26 66 45 56 50 52 Z"
        fill="#FAF8F5"
      />

      {/* Upper sand */}
      <g clipPath="url(#hg-top-bulb)">
        <rect
          x="22"
          y={topY}
          width="56"
          height={topHeight + 2}
          fill={sandColor}
          opacity={isActiveParticipant ? 0.92 : 0.45}
          className="transition-all duration-150"
        />
      </g>

      {/* Lower sand */}
      <g clipPath="url(#hg-bottom-bulb)">
        <rect
          x="22"
          y={bottomY}
          width="56"
          height={bottomHeight + 2}
          fill={sandColor}
          opacity={isActiveParticipant ? 0.92 : 0.45}
          className="transition-all duration-150"
        />
      </g>

      {/* Falling sand stream */}
      {streamActive && (
        <line
          x1="50"
          y1="48"
          x2="50"
          y2="82"
          stroke={sandColor}
          strokeWidth="2.4"
          strokeLinecap="round"
          className="animate-sand-stream"
        />
      )}

      {/* Hourglass outline */}
      <path
        d="M26 16 C26 34 45 44 50 50 C45 56 26 66 26 84"
        fill="none"
        stroke={frameColor}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M74 16 C74 34 55 44 50 50 C55 56 74 66 74 84"
        fill="none"
        stroke={frameColor}
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      {/* Top & bottom caps */}
      <line
        x1="20"
        y1="14"
        x2="80"
        y2="14"
        stroke={frameColor}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="86"
        x2="80"
        y2="86"
        stroke={frameColor}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
