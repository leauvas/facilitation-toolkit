import React from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileAudio,
  FileJson,
  FileSpreadsheet,
  FileText,
  X,
} from 'lucide-react';
import { useSession } from '../context/SessionContext';
import {
  buildAiSummaryPrompt,
  buildStatsClipboardText,
  buildStatsCsv,
  buildTimelineJson,
  buildTimelineText,
  computeParticipantStats,
  formatClockMMSS,
  formatFilePrefix,
  triggerFileDownload,
} from '../lib/exportUtils';

export const ResultModal: React.FC = () => {
  const { resultModal, closeResultModal, showToast } = useSession();

  if (!resultModal) return null;

  const { record, audioParts, isRecovered } = resultModal;
  const prefix = formatFilePrefix(record.sessionStartedAt);

  const { stats, facilitatorTotalSec } = computeParticipantStats(
    record.participants,
    record.timeline
  );

  const handleCopyPrompt = async () => {
    const prompt = buildAiSummaryPrompt(record.sessionStartedAt, record.participants);
    try {
      await navigator.clipboard.writeText(prompt);
      showToast('제미나이/GPT용 회의록 프롬프트를 클립보드에 복사했습니다.');
    } catch {
      showToast('클립보드 복사에 실패했습니다.');
    }
  };

  const handleDownloadTimelineTxt = () => {
    const text = buildTimelineText(record.timeline);
    triggerFileDownload(text, `${prefix}화자_타임라인.txt`, 'text/plain;charset=utf-8');
  };

  const handleDownloadTimelineJson = () => {
    const json = buildTimelineJson(record);
    triggerFileDownload(json, `${prefix}timeline.json`, 'application/json;charset=utf-8');
  };

  const handleCopyStats = async () => {
    const text = buildStatsClipboardText(stats, facilitatorTotalSec);
    try {
      await navigator.clipboard.writeText(text);
      showToast('발언 균형 통계 요약표를 클립보드에 복사했습니다.');
    } catch {
      showToast('클립보드 복사에 실패했습니다.');
    }
  };

  const handleDownloadCsv = () => {
    const csv = buildStatsCsv(stats, facilitatorTotalSec);
    triggerFileDownload(csv, `${prefix}발언균형통계.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 p-3 backdrop-blur-xs sm:p-5">
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-stone-100 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-lime-800" />
              <h2 className="text-base font-bold text-stone-900">
                {isRecovered ? '복구된 세션 결과 리포트' : '세션 결과 리포트'}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-stone-600 tabular-nums">
              {new Date(record.sessionStartedAt).toLocaleString('ko-KR')} · 총 시간{' '}
              {formatClockMMSS(record.totalDurationSec)}
            </p>
          </div>
          <button
            type="button"
            onClick={closeResultModal}
            className="rounded-full p-1.5 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            aria-label="결과 모달 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {/* Track A & Track B Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Track A: General AI Summary */}
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-lime-100/80 px-2.5 py-0.5 text-[11px] font-bold text-lime-800">
                  Track A · 원클릭 AI 요약용
                </span>
              </div>
              <p className="mb-3 text-xs text-stone-600">
                녹음 파일과 화자 타임라인을 AI(제미나이/GPT)에 첨부하고 프롬프트를 붙여넣으세요.
              </p>

              <div className="space-y-2">
                {record.recordingEnabled ? (
                  audioParts.length > 0 ? (
                    <div className="space-y-1.5">
                      {audioParts.map((part) => {
                        const filename =
                          audioParts.length > 1
                            ? `${prefix}녹음원본_part${part.part}.${part.ext}`
                            : `${prefix}녹음원본.${part.ext}`;
                        return (
                          <button
                            key={part.part}
                            type="button"
                            onClick={() => triggerFileDownload(part.blob, filename)}
                            className="flex w-full items-center justify-between rounded-xl border border-stone-200 bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-900 transition hover:border-lime-600 hover:bg-lime-100/80"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <FileAudio className="h-4 w-4 shrink-0 text-lime-800" />
                              <span className="truncate">{filename}</span>
                            </span>
                            <Download className="h-3.5 w-3.5 shrink-0 text-lime-800" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-stone-200 bg-stone-100 px-3 py-2 text-xs text-stone-600">
                      저장된 오디오 청크가 없습니다.
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-200 bg-stone-100 px-3 py-2 text-xs text-stone-400">
                    녹음 OFF 세션 — 오디오 파일 비활성화
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDownloadTimelineTxt}
                  className="flex w-full items-center justify-between rounded-xl border border-stone-200 bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-900 transition hover:border-lime-600 hover:bg-lime-100/80"
                >
                  <span className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4 shrink-0 text-lime-800" />
                    <span className="truncate">{prefix}화자_타임라인.txt</span>
                  </span>
                  <Download className="h-3.5 w-3.5 shrink-0 text-lime-800" />
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopyPrompt()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-lime-700 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-lime-800"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  <span>제미나이/GPT용 회의록 프롬프트 복사</span>
                </button>
              </div>
            </div>

            {/* Track B: Local Whisper Precision JSON */}
            <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-orange-700">
                    Track B · 로컬 CPU Whisper 연동용
                  </span>
                </div>
                <p className="mb-3 text-xs text-stone-600">
                  실제 오디오 재생 시간 기준(0.00초) 및 분할 파트(audioPart, partStartSec, partEndSec)가 포함된 정밀 메타데이터입니다.
                </p>

                <div className="space-y-1 rounded-xl border border-stone-200 bg-stone-100 p-3 text-[11px] text-stone-600 tabular-nums">
                  <div className="flex justify-between">
                    <span>총 오디오 길이</span>
                    <span className="font-bold text-stone-900">
                      {record.totalDurationSec.toFixed(2)}s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>타임라인 구간 수</span>
                    <span className="font-bold text-stone-900">
                      {record.timeline.length}개 구간
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>오디오 포맷 / 파트</span>
                    <span className="font-bold text-stone-900">
                      {record.audioMimeType || 'none'} ({Math.max(1, audioParts.length)}파트)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>일시정지/이탈 기록</span>
                    <span className="font-bold text-stone-900">
                      {record.pausedRanges.length}건
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadTimelineJson}
                className="mt-3 flex w-full items-center justify-between rounded-xl border border-orange-500 bg-orange-50 px-3 py-2.5 text-xs font-bold text-orange-700 transition hover:bg-orange-100"
              >
                <span className="flex items-center gap-2 truncate">
                  <FileJson className="h-4 w-4 shrink-0" />
                  <span className="truncate">{prefix}timeline.json</span>
                </span>
                <Download className="h-3.5 w-3.5 shrink-0" />
              </button>
            </div>
          </div>

          {/* Speaking Balance Statistics Table */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-stone-900">발언 균형 통계 요약</h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleCopyStats()}
                  className="flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-900 transition hover:bg-stone-200"
                >
                  <ClipboardCopy className="h-3 w-3" />
                  <span>요약표 복사</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1 rounded-full border border-lime-600 bg-lime-100/80 px-3 py-1 text-xs font-semibold text-lime-800 transition hover:bg-lime-200/70"
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  <span>CSV 다운로드</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-600">
                    <th className="py-2 pr-3 font-semibold">이름</th>
                    <th className="px-2 py-2 font-semibold">총 발언 시간</th>
                    <th className="px-2 py-2 font-semibold">발언 횟수</th>
                    <th className="pl-2 py-2 text-right font-semibold">참여자 내 점유율</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 tabular-nums">
                  {stats.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 pr-3 font-bold text-stone-900">{s.name}</td>
                      <td className="px-2 py-2 text-stone-600">{formatClockMMSS(s.totalSec)}</td>
                      <td className="px-2 py-2 text-stone-600">{s.turnCount}회</td>
                      <td className="pl-2 py-2 text-right font-bold text-lime-800">
                        {s.sharePct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-stone-100 font-semibold text-stone-600">
                    <td className="py-2 pr-3 text-stone-900">진행자 (별도 집계)</td>
                    <td className="px-2 py-2">{formatClockMMSS(facilitatorTotalSec)}</td>
                    <td className="px-2 py-2">-</td>
                    <td className="pl-2 py-2 text-right">별도 표시</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
