import { formatDayShort, formatTime, toDayKey } from '@/domain/dates';
import { editWindowEnd } from '@/domain/permissions';
import type { Report } from '@/domain/types';

/** "Modifiable jusqu'à 14h05" (aujourd'hui) ou "jusqu'à demain 14h05" / "jusqu'au 10 oct. à 14h05". */
export function editHint(report: Pick<Report, 'submittedAt'>, now: number): string {
  const end = editWindowEnd(report);
  const today = toDayKey(now);
  const endDay = toDayKey(end);
  const time = formatTime(end);
  if (endDay === today) return `Modifiable jusqu'à ${time}`;
  const tomorrow = toDayKey(now + 24 * 3600_000);
  if (endDay === tomorrow) return `Modifiable jusqu'à demain ${time}`;
  return `Modifiable jusqu'au ${formatDayShort(endDay)} à ${time}`;
}
