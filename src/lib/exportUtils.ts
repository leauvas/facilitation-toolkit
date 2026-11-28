import {
  Participant,
  ParticipantStat,
  SessionMarker,
  SessionRecord,
  TimelineEntry,
} from '../types/facilitation';

export function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

export function formatFilePrefix(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return formatFilePrefix(now.toISOString());
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}_`;
}

export function formatClockMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function buildTimelineText(
  timeline: TimelineEntry[],
  sessionMarkers: SessionMarker[] = []
): string {
  const speakerTurnCounts = new Map<string, number>();
  const lines: string[] = [];
  const emittedMarkers = new Set<number>();

  const emitMarkersUpTo = (sessionNum: number) => {
    for (const marker of sessionMarkers) {
      if (!emittedMarkers.has(marker.sessionNumber) && marker.sessionNumber <= sessionNum) {
        emittedMarkers.add(marker.sessionNumber);
        lines.push(`[${formatClockMMSS(marker.audioOffsetSec)}] === ${marker.label} ===`);
      }
    }
  };

  for (const entry of timeline) {
    if (sessionMarkers.length > 0) {
      emitMarkersUpTo(entry.sessionNumber ?? 1);
    }

    const startLabel = formatClockMMSS(entry.startSec);
    const endLabel = formatClockMMSS(entry.endSec);
    if (entry.speakerId === 'facilitator' || entry.speaker === '진행자') {
      lines.push(`[${startLabel} - ${endLabel}] 진행자`);
    } else if (entry.isContinuation) {
      const currentTurn = Math.max(1, speakerTurnCounts.get(entry.speakerId) ?? 1);
      lines.push(`[${startLabel} - ${endLabel}] ${entry.speaker} (발언 #${currentTurn} 이어서)`);
    } else {
      const nextTurn = (speakerTurnCounts.get(entry.speakerId) ?? 0) + 1;
      speakerTurnCounts.set(entry.speakerId, nextTurn);
      lines.push(`[${startLabel} - ${endLabel}] ${entry.speaker} (발언 #${nextTurn})`);
    }
  }

  for (const marker of sessionMarkers) {
    if (!emittedMarkers.has(marker.sessionNumber)) {
      emittedMarkers.add(marker.sessionNumber);
      lines.push(`[${formatClockMMSS(marker.audioOffsetSec)}] === ${marker.label} ===`);
    }
  }

  return lines.join('\n');
}

export function buildAiSummaryPrompt(sessionStartedAt: string, participants: Participant[]): string {
  const dateLabel = new Date(sessionStartedAt).toLocaleString('ko-KR');
  const names = participants.map((p) => p.name).join(', ');
  return [
    '첨부한 녹음 파일과 화자 타임라인(화자_타임라인.txt)을 함께 참고하여 퍼실리테이션 회의록을 작성해 주세요.',
    '',
    `- 세션 시작 일시: ${dateLabel}`,
    `- 참여자: ${names} (및 진행자)`,
    '',
    '[작성 요청 사항]',
    '1. 전체 논의 요약 (3~5줄 핵심 정리)',
    '2. 화자별 주요 발언 및 핵심 관점 정리 (타임라인의 화자 이름을 정확히 매칭)',
    '3. 논의 중 도출된 합의사항 및 쟁점',
    '4. 향후 실행 과제 (Action Items / 담당자 / 기한 포함)',
    '',
    '타임라인의 시간 구간([MM:SS - MM:SS])과 오디오의 해당 구간을 대조해 화자를 혼동하지 않도록 주의해 주세요.',
  ].join('\n');
}

export function buildTimelineJson(record: SessionRecord): string {
  const payload = {
    sessionStartedAt: record.sessionStartedAt,
    totalDurationSec: round2(record.totalDurationSec),
    audioMimeType: record.audioMimeType || 'none',
    sessionMarkers: (record.sessionMarkers ?? []).map((m) => ({
      ...m,
      audioOffsetSec: round2(m.audioOffsetSec),
    })),
    pausedRanges: record.pausedRanges.map((r) => ({
      ...r,
      audioOffsetSec: round2(r.audioOffsetSec),
    })),
    timeline: record.timeline.map((t) => ({
      turn: t.turn,
      speaker: t.speaker,
      startSec: round2(t.startSec),
      endSec: round2(t.endSec),
      durationSec: round2(t.durationSec),
      audioPart: t.audioPart,
      partStartSec: round2(t.partStartSec),
      partEndSec: round2(t.partEndSec),
      ...(t.sessionNumber ? { sessionNumber: t.sessionNumber } : {}),
    })),
  };

  return JSON.stringify(payload, null, 2);
}

export function computeParticipantStats(
  participants: Participant[],
  timeline: TimelineEntry[]
): { stats: ParticipantStat[]; facilitatorTotalSec: number; participantsTotalSec: number } {
  const totals = new Map<string, number>();
  const turns = new Map<string, number>();
  let facilitatorTotalSec = 0;

  for (const entry of timeline) {
    if (entry.speakerId === 'facilitator') {
      facilitatorTotalSec += entry.durationSec;
    } else {
      totals.set(entry.speakerId, (totals.get(entry.speakerId) ?? 0) + entry.durationSec);
      if (!entry.isContinuation) {
        turns.set(entry.speakerId, (turns.get(entry.speakerId) ?? 0) + 1);
      }
    }
  }

  let participantsTotalSec = 0;
  for (const p of participants) {
    participantsTotalSec += totals.get(p.id) ?? 0;
  }

  const stats: ParticipantStat[] = participants.map((p) => {
    const totalSec = totals.get(p.id) ?? 0;
    const turnCount = turns.get(p.id) ?? 0;
    const sharePct =
      participantsTotalSec > 0 ? Math.round((totalSec / participantsTotalSec) * 1000) / 10 : 0;
    return {
      id: p.id,
      name: p.name,
      totalSec,
      turnCount,
      sharePct,
    };
  });

  return { stats, facilitatorTotalSec, participantsTotalSec };
}

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildStatsCsv(stats: ParticipantStat[], facilitatorTotalSec: number): string {
  const rows = [
    ['구분', '이름', '총 발언 시간(초)', '총 발언 시간(MM:SS)', '발언 횟수', '참여자 내 점유율(%)'],
    ...stats.map((s) => [
      '참여자',
      s.name,
      String(round2(s.totalSec)),
      formatClockMMSS(s.totalSec),
      String(s.turnCount),
      `${s.sharePct.toFixed(1)}%`,
    ]),
    [
      '진행자',
      '진행자',
      String(round2(facilitatorTotalSec)),
      formatClockMMSS(facilitatorTotalSec),
      '-',
      '별도 집계',
    ],
  ];

  const csvBody = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  return `\uFEFF${csvBody}`;
}

export function buildStatsClipboardText(stats: ParticipantStat[], facilitatorTotalSec: number): string {
  const lines = [
    '[발언 균형 통계 요약]',
    ...stats.map(
      (s) =>
        `- ${s.name}: ${formatClockMMSS(s.totalSec)} (${s.turnCount}회, 점유율 ${s.sharePct.toFixed(1)}%)`
    ),
    `- 진행자(별도): ${formatClockMMSS(facilitatorTotalSec)}`,
  ];
  return lines.join('\n');
}

export function triggerFileDownload(content: Blob | string, filename: string, mimeType?: string): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mimeType ?? 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 60000);
}
