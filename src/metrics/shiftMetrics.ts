/** Shift Metrics — Rollover Rate & Velocity Under Load (optimized) */

import type { JiraIssue, StatusClassification } from '../types';
import type { WorkSchedule } from './workingHours';
import { getDateRangeArray, toISODate } from '../utils/dateUtils';

export interface ShiftRollover {
  shiftName: string;
  day: string;
  openAtShiftEnd: number;
  closedDuringShift: number;
  rolloverRate: number;
}

export interface RolloverSummary {
  byShift: Array<{ shiftName: string; avgRolloverRate: number; worstDay: string; worstRate: number }>;
  heatmapData: Array<{ x: string; y: string; value: number }>;
}

export interface VelocityPoint {
  date: string;
  queueDepth: number;
  closeRate: number;
}

export function calculateRolloverByShift(
  issues: JiraIssue[],
  schedule: WorkSchedule,
  _statusMapping: Record<string, StatusClassification>,
  dateRange: { start: Date; end: Date },
): RolloverSummary {
  const days = getDateRangeArray(dateRange.start, dateRange.end).map(toISODate);
  const shiftNames = schedule.shifts.map((s) => s.name);

  // O(n): Index issues by created/closed date once
  const createdByDay = new Map<string, number>();
  const closedByDay = new Map<string, number>();
  const openOnDay = new Map<string, number>(); // running count

  for (const issue of issues) {
    const createdDate = issue.fields.created.split('T')[0];
    createdByDay.set(createdDate, (createdByDay.get(createdDate) ?? 0) + 1);

    if (issue.fields.resolutiondate) {
      const closedDate = issue.fields.resolutiondate.split('T')[0];
      closedByDay.set(closedDate, (closedByDay.get(closedDate) ?? 0) + 1);
    }
  }

  // O(d): Compute running open count per day
  let runningOpen = 0;
  // Count issues created before the range
  for (const issue of issues) {
    const createdDate = issue.fields.created.split('T')[0];
    const closedDate = issue.fields.resolutiondate?.split('T')[0] ?? null;
    if (createdDate < days[0] && (closedDate === null || closedDate >= days[0])) {
      runningOpen++;
    }
  }

  for (const dayStr of days) {
    runningOpen += createdByDay.get(dayStr) ?? 0;
    runningOpen -= closedByDay.get(dayStr) ?? 0;
    openOnDay.set(dayStr, Math.max(0, runningOpen));
  }

  // O(d*s): Compute rollover per shift per day
  const rollovers: ShiftRollover[] = [];

  for (const dayStr of days) {
    const openCount = openOnDay.get(dayStr) ?? 0;
    const closedCount = closedByDay.get(dayStr) ?? 0;

    for (const shiftName of shiftNames) {
      // Simplified: attribute all daily activity to each shift proportionally
      // In a real multi-shift setup, we'd check transition timestamps against shift hours
      const total = openCount + closedCount;
      const rolloverRate = total > 0 ? openCount / total : 0;

      rollovers.push({
        shiftName,
        day: dayStr,
        openAtShiftEnd: openCount,
        closedDuringShift: closedCount,
        rolloverRate,
      });
    }
  }

  // Aggregate by shift
  const byShift = shiftNames.map((name) => {
    const shiftData = rollovers.filter((r) => r.shiftName === name);
    const rates = shiftData.map((r) => r.rolloverRate);
    const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    const worst = shiftData.reduce(
      (max, r) => (r.rolloverRate > max.rolloverRate ? r : max),
      shiftData[0],
    );
    return {
      shiftName: name,
      avgRolloverRate: avg,
      worstDay: worst?.day ?? '',
      worstRate: worst?.rolloverRate ?? 0,
    };
  });

  // Heatmap: x = day-of-week, y = shift name
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heatmapAccum = new Map<string, { total: number; count: number }>();

  for (const r of rollovers) {
    const dow = dayNames[new Date(r.day + 'T12:00:00').getDay()];
    const key = `${dow}|${r.shiftName}`;
    const existing = heatmapAccum.get(key) || { total: 0, count: 0 };
    existing.total += r.rolloverRate;
    existing.count++;
    heatmapAccum.set(key, existing);
  }

  const heatmapData: Array<{ x: string; y: string; value: number }> = [];
  heatmapAccum.forEach((v, key) => {
    const [x, y] = key.split('|');
    heatmapData.push({ x, y, value: Math.round((v.total / v.count) * 100) });
  });

  return { byShift, heatmapData };
}

export function calculateVelocityUnderLoad(
  issues: JiraIssue[],
  dateRange: { start: Date; end: Date },
): VelocityPoint[] {
  const days = getDateRangeArray(dateRange.start, dateRange.end).map(toISODate);

  // O(n): Pre-index created and closed dates
  const createdByDay = new Map<string, number>();
  const closedByDay = new Map<string, number>();

  for (const issue of issues) {
    const createdDate = issue.fields.created.split('T')[0];
    createdByDay.set(createdDate, (createdByDay.get(createdDate) ?? 0) + 1);

    if (issue.fields.resolutiondate) {
      const closedDate = issue.fields.resolutiondate.split('T')[0];
      closedByDay.set(closedDate, (closedByDay.get(closedDate) ?? 0) + 1);
    }
  }

  // O(n): Count issues open before range start
  let runningOpen = 0;
  for (const issue of issues) {
    const createdDate = issue.fields.created.split('T')[0];
    const closedDate = issue.fields.resolutiondate?.split('T')[0] ?? null;
    if (createdDate < days[0] && (closedDate === null || closedDate >= days[0])) {
      runningOpen++;
    }
  }

  // O(d): Build velocity points
  const points: VelocityPoint[] = [];

  for (const dayStr of days) {
    runningOpen += createdByDay.get(dayStr) ?? 0;
    const closeRate = closedByDay.get(dayStr) ?? 0;

    points.push({ date: dayStr, queueDepth: runningOpen, closeRate });

    runningOpen -= closeRate;
    runningOpen = Math.max(0, runningOpen);
  }

  return points;
}
