/** Effective Headcount — base headcount adjusted by ledger events */

import type { WorkSchedule } from '../metrics/workingHours';
import type { LedgerEvent } from '../store/dashboardStore';
import { getDateRangeArray, toISODate } from '../utils/dateUtils';

export interface HeadcountPoint {
  date: string;
  shiftName: string;
  baseHeadcount: number;
  adjustment: number;
  effective: number;
}

export function calculateEffectiveHeadcount(
  schedule: WorkSchedule,
  ledgerEvents: LedgerEvent[],
  dateRange: { start: Date; end: Date },
): HeadcountPoint[] {
  const days = getDateRangeArray(dateRange.start, dateRange.end).map(toISODate);
  const points: HeadcountPoint[] = [];

  for (const dayStr of days) {
    for (const shift of schedule.shifts) {
      let adjustment = 0;

      for (const event of ledgerEvents) {
        if (dayStr < event.startDate || dayStr > event.endDate) continue;

        // Check scope
        if (event.scope === 'shift' && event.shiftName && event.shiftName !== shift.name) continue;

        // Apply impact
        if (event.type === 'absence') {
          adjustment -= event.impact ?? 1;
        } else if (event.type === 'new_hire') {
          adjustment += event.impact ?? 1;
        } else if (event.type === 'system_downtime') {
          // Downtime doesn't change headcount, but we note it
        } else if (event.type === 'holiday') {
          adjustment -= shift.baseHeadcount; // full shift off
        }
      }

      points.push({
        date: dayStr,
        shiftName: shift.name,
        baseHeadcount: shift.baseHeadcount,
        adjustment,
        effective: Math.max(0, shift.baseHeadcount + adjustment),
      });
    }
  }

  return points;
}
