import React from 'react';

interface HourglassSvgProps {
  remainingRatio: number;
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
  sizeClass = 'h-12 w-12 sm:h-16 sm:w-16',
}) => {
  const clamped = isActiveParticipant ? Math.max(0, Math.min(1, remainingRatio)) : 0.65;
  const filledBottomRatio = isActiveParticipant ? 1 - clamped : 0.35;

  const sandFillClass = !isActiveParticipant
    ? 'fill-stone-400'
    : isOvertime
      ? 'fill-orange-600'
      : 'fill-lime-700';

  const streamStrokeClass = !isActiveParticipant
    ? 'stroke-stone-400'
    : isOvertime
      ? 'stroke-orange-600'
      : 'stroke-lime-700';

  const frameStrokeClass = !isActiveParticipant
    ? 'stroke-stone-500'
    : isOvertime
      ? 'stroke-orange-700'
      : 'stroke-lime-800';

  const topHeight = 28 * clamped;
  const topY = 46 - topHeight;
  const bottomHeight = 28 * filledBottomRatio;
  const bottomY = 84 - bottomHeight;
  const streamActive = isActiveParticipant && !isPaused && clamped > 0;

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${sizeClass} shrink-0 select-none transition-colors duration-300`}
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

      <path
        d="M26 16 H74 C74 34 55 44 50 48 C45 44 26 34 26 16 Z"
        className="fill-stone-50"
      />
      <path
        d="M50 52 C55 56 74 66 74 84 H26 C26 66 45 56 50 52 Z"
        className="fill-stone-50"
      />

      <g clipPath="url(#hg-top-bulb)">
        <rect
          x="22"
          y={topY}
          width="56"
          height={topHeight + 2}
          opacity={isActiveParticipant ? 0.92 : 0.45}
          className={`${sandFillClass} transition-all duration-150`}
        />
      </g>

      <g clipPath="url(#hg-bottom-bulb)">
        <rect
          x="22"
          y={bottomY}
          width="56"
          height={bottomHeight + 2}
          opacity={isActiveParticipant ? 0.92 : 0.45}
          className={`${sandFillClass} transition-all duration-150`}
        />
      </g>

      {streamActive && (
        <line
          x1="50"
          y1="48"
          x2="50"
          y2="82"
          strokeWidth="2.4"
          strokeLinecap="round"
          className={`${streamStrokeClass} animate-sand-stream`}
        />
      )}

      <path
        d="M26 16 C26 34 45 44 50 50 C45 56 26 66 26 84"
        fill="none"
        strokeWidth="3.2"
        strokeLinecap="round"
        className={frameStrokeClass}
      />
      <path
        d="M74 16 C74 34 55 44 50 50 C55 56 74 66 74 84"
        fill="none"
        strokeWidth="3.2"
        strokeLinecap="round"
        className={frameStrokeClass}
      />

      <line
        x1="20"
        y1="14"
        x2="80"
        y2="14"
        strokeWidth="4.5"
        strokeLinecap="round"
        className={frameStrokeClass}
      />
      <line
        x1="20"
        y1="86"
        x2="80"
        y2="86"
        strokeWidth="4.5"
        strokeLinecap="round"
        className={frameStrokeClass}
      />
    </svg>
  );
};
