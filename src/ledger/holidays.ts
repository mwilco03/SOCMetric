/** Federal Holiday Integration — US federal holidays only */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import Holidays from 'date-holidays';
import type { ExcludedPeriod } from '../metrics/workingHours';

export interface HolidayEntry {
  date: string;
  name: string;
}

let holidayInstance: InstanceType<typeof Holidays> | null = null;

function getHolidays(): InstanceType<typeof Holidays> {
  if (!holidayInstance) {
    holidayInstance = new Holidays('US');
  }
  return holidayInstance;
}

export function getFederalHolidays(year: number): HolidayEntry[] {
  const hd = getHolidays();
  const all = hd.getHolidays(year) as Array<{
    date: string;
    name: string;
    type: string;
  }>;

  // Only public holidays (federal), skip observances like Valentine's Day
  return all
    .filter((h: { type: string }) => h.type === 'public')
    .map((h: { date: string; name: string }) => ({
      date: h.date.split(' ')[0], // "2026-01-01 00:00:00" -> "2026-01-01"
      name: h.name,
    }));
}

export function getHolidayExclusions(
  dateRange: { start: Date; end: Date },
): ExcludedPeriod[] {
  const startYear = dateRange.start.getFullYear();
  const endYear = dateRange.end.getFullYear();
  const exclusions: ExcludedPeriod[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const holidays = getFederalHolidays(year);
    for (const h of holidays) {
      const dayStart = new Date(h.date + 'T00:00:00');
      const dayEnd = new Date(h.date + 'T23:59:59');

      // Only include if within date range
      if (dayEnd >= dateRange.start && dayStart <= dateRange.end) {
        exclusions.push({ start: dayStart, end: dayEnd });
      }
    }
  }

  return exclusions;
}
