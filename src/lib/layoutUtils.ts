import { BalanceSettings, FacilitatorSeat, Participant, TableShape } from '../types/facilitation';

const STORAGE_KEY = 'facilitation_balance_settings_v1';

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 12;

const DEFAULT_NAMES = [
  '김민수',
  '이서연',
  '박지훈',
  '최수빈',
  '정우진',
  '한지민',
  '강도현',
  '윤채원',
  '조현우',
  '임하은',
  '송태양',
  '배수진',
];

// [top, right, bottom, left] counts for 2..13 seats (up to 12 participants + 1 facilitator)
const RECT_SIDE_ALLOC: Record<number, [number, number, number, number]> = {
  2: [1, 0, 1, 0],
  3: [1, 1, 1, 0],
  4: [1, 1, 1, 1],
  5: [2, 1, 1, 1],
  6: [2, 1, 2, 1],
  7: [2, 1, 2, 2],
  8: [2, 2, 2, 2],
  9: [3, 2, 2, 2],
  10: [3, 2, 3, 2],
  11: [4, 2, 3, 2],
  12: [4, 2, 4, 2],
  13: [4, 3, 4, 2],
};

export function snapPercent(val: number, min = 8, max = 92): number {
  const clamped = Math.max(min, Math.min(max, val));
  return Math.round(clamped / 2) * 2;
}

function distributeLine(count: number, min: number, max: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [50];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, idx) => Math.round((min + step * idx) * 10) / 10);
}

export function getDefaultPositions(count: number, shape: TableShape): Array<{ x: number; y: number }> {
  const safeCount = Math.max(MIN_PARTICIPANTS, Math.min(MAX_PARTICIPANTS + 1, count));

  if (shape === 'circle') {
    const rx = safeCount >= 9 ? 39 : 37;
    const ry = safeCount >= 9 ? 38 : 36;
    return Array.from({ length: safeCount }, (_, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / safeCount;
      return {
        x: snapPercent(50 + rx * Math.cos(angle), 12, 88),
        y: snapPercent(50 + ry * Math.sin(angle), 12, 88),
      };
    });
  }

  const [topCount, rightCount, bottomCount, leftCount] = RECT_SIDE_ALLOC[safeCount] ?? [4, 3, 4, 2];
  const positions: Array<{ x: number; y: number }> = [];

  const topXs = distributeLine(topCount, topCount >= 4 ? 18 : 28, topCount >= 4 ? 82 : 72);
  for (const x of topXs) {
    positions.push({ x: snapPercent(x, 12, 88), y: 12 });
  }

  const rightYs = distributeLine(rightCount, rightCount >= 3 ? 28 : 35, rightCount >= 3 ? 72 : 65);
  for (const y of rightYs) {
    positions.push({ x: 88, y: snapPercent(y, 16, 84) });
  }

  const bottomXs = distributeLine(
    bottomCount,
    bottomCount >= 4 ? 18 : 28,
    bottomCount >= 4 ? 82 : 72
  ).reverse();
  for (const x of bottomXs) {
    positions.push({ x: snapPercent(x, 12, 88), y: 88 });
  }

  const leftYs = distributeLine(leftCount, 35, 65).reverse();
  for (const y of leftYs) {
    positions.push({ x: 12, y: snapPercent(y, 16, 84) });
  }

  return positions;
}

export function getDefaultLayoutWithFacilitator(
  participantCount: number,
  shape: TableShape,
  includeFacilitator = true
): { participantPositions: Array<{ x: number; y: number }>; facilitatorSeat: FacilitatorSeat } {
  const totalSeats = includeFacilitator ? participantCount + 1 : participantCount;
  const allPositions = getDefaultPositions(totalSeats, shape);

  if (!includeFacilitator) {
    return {
      participantPositions: allPositions.slice(0, participantCount),
      facilitatorSeat: { x: 50, y: 88 },
    };
  }

  // Place facilitator in the last seat (or bottom-center / top-center slot depending on count)
  const facilitatorSeat = allPositions[allPositions.length - 1] ?? { x: 50, y: 88 };
  const participantPositions = allPositions.slice(0, participantCount);
  return { participantPositions, facilitatorSeat };
}

export function getDefaultParticipants(count = 6, shape: TableShape = 'rect'): Participant[] {
  const { participantPositions } = getDefaultLayoutWithFacilitator(count, shape, true);
  return participantPositions.map((pos, idx) => ({
    id: `p_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`,
    name: DEFAULT_NAMES[idx] ?? `참여자 ${idx + 1}`,
    x: pos.x,
    y: pos.y,
  }));
}

export function redistributeWithFacilitator(
  participants: Participant[],
  shape: TableShape,
  includeFacilitator = true
): { participants: Participant[]; facilitatorSeat: FacilitatorSeat } {
  const { participantPositions, facilitatorSeat } = getDefaultLayoutWithFacilitator(
    participants.length,
    shape,
    includeFacilitator
  );
  return {
    participants: participants.map((p, idx) => ({
      ...p,
      x: participantPositions[idx]?.x ?? p.x,
      y: participantPositions[idx]?.y ?? p.y,
    })),
    facilitatorSeat,
  };
}

export function findEmptySeatPosition(
  existing: Array<{ x: number; y: number }>,
  shape: TableShape
): { x: number; y: number } {
  const targetCount = Math.min(MAX_PARTICIPANTS + 1, Math.max(MIN_PARTICIPANTS, existing.length + 1));
  const candidates = [
    ...getDefaultPositions(targetCount, shape),
    ...getDefaultPositions(MAX_PARTICIPANTS + 1, shape),
    { x: 20, y: 20 },
    { x: 80, y: 20 },
    { x: 20, y: 80 },
    { x: 80, y: 80 },
  ];

  if (existing.length === 0) {
    return candidates[0];
  }

  let best = candidates[0];
  let bestMinDist = -1;

  for (const candidate of candidates) {
    let minDist = Infinity;
    for (const p of existing) {
      const dx = candidate.x - p.x;
      const dy = candidate.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) minDist = dist;
    }
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      best = candidate;
    }
  }

  return best;
}

export function createParticipant(
  existing: Participant[],
  shape: TableShape,
  facilitatorSeat?: FacilitatorSeat,
  showFacilitatorSeat = true
): Participant {
  const occupied: Array<{ x: number; y: number }> = showFacilitatorSeat && facilitatorSeat
    ? [...existing, facilitatorSeat]
    : existing;
  const pos = findEmptySeatPosition(occupied, shape);
  const nextIndex = existing.length + 1;
  return {
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: DEFAULT_NAMES[nextIndex - 1] ?? `참여자 ${nextIndex}`,
    x: pos.x,
    y: pos.y,
  };
}

export function loadBalanceSettings(): BalanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BalanceSettings>;
      const tableShape: TableShape = parsed.tableShape === 'circle' ? 'circle' : 'rect';
      const showFacilitatorSeat =
        typeof parsed.showFacilitatorSeat === 'boolean' ? parsed.showFacilitatorSeat : true;

      const participants =
        Array.isArray(parsed.participants) && parsed.participants.length >= MIN_PARTICIPANTS
          ? parsed.participants.slice(0, MAX_PARTICIPANTS).map((p, idx) => ({
              id: typeof p.id === 'string' && p.id ? p.id : `p_${idx + 1}`,
              name: typeof p.name === 'string' && p.name.trim() ? p.name : `참여자 ${idx + 1}`,
              x: typeof p.x === 'number' ? snapPercent(p.x, 8, 92) : 50,
              y: typeof p.y === 'number' ? snapPercent(p.y, 10, 90) : 50,
            }))
          : getDefaultParticipants(6, tableShape);

      const facilitatorSeat: FacilitatorSeat =
        parsed.facilitatorSeat &&
        typeof parsed.facilitatorSeat.x === 'number' &&
        typeof parsed.facilitatorSeat.y === 'number'
          ? {
              x: snapPercent(parsed.facilitatorSeat.x, 8, 92),
              y: snapPercent(parsed.facilitatorSeat.y, 10, 90),
            }
          : findEmptySeatPosition(participants, tableShape);

      const recommendedTurnSec =
        typeof parsed.recommendedTurnSec === 'number' && parsed.recommendedTurnSec >= 30
          ? parsed.recommendedTurnSec
          : 120;
      const goalMinutes =
        typeof parsed.goalMinutes === 'number' && parsed.goalMinutes >= 5 && parsed.goalMinutes <= 360
          ? parsed.goalMinutes
          : 60;

      return {
        participants,
        facilitatorSeat,
        showFacilitatorSeat,
        tableShape,
        recommendedTurnSec,
        goalMinutes,
      };
    }
  } catch {
    // Fallback to defaults if localStorage is unavailable or corrupted
  }

  const defaultShape: TableShape = 'rect';
  const defaultParticipants = getDefaultParticipants(6, defaultShape);
  const { facilitatorSeat } = getDefaultLayoutWithFacilitator(
    defaultParticipants.length,
    defaultShape,
    true
  );

  return {
    participants: defaultParticipants,
    facilitatorSeat,
    showFacilitatorSeat: true,
    tableShape: defaultShape,
    recommendedTurnSec: 120,
    goalMinutes: 60,
  };
}

export function saveBalanceSettings(settings: BalanceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}
