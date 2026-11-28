import { useEffect, useState } from 'react';

function formatHHMM(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function useCurrentTimeHHMM(): string {
  const [timeStr, setTimeStr] = useState<string>(() => formatHHMM(new Date()));

  useEffect(() => {
    const update = () => setTimeStr(formatHHMM(new Date()));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  return timeStr;
}
