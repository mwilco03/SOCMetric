/** Working Hours Calculation Engine */

import {
  differenceInMinutes,
  addDays,
  startOfDay,
  getDay,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { MAX_WORKING_DAYS_CAP } from '../constants';

export interface Shift {
  name: string;
  timezone: string;
  startHour: number;
  endHour: number;
  workDays: string[];
  baseHeadcount: number;
}

export interface WorkSchedule {
  timezone: string;
  shifts: Shift[];
}

export interface ExcludedPeriod {
  start: Date;
  end: Date;
}

const DAY_MAP: Record<string, number> = {
  'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6,
};

function isWorkingDay(date: Date, shift: Shift): boolean {
  const zoned = toZonedTime(date, shift.timezone);
  const dayNum = getDay(zoned);
  const shiftDays = shift.workDays.map(d => DAY_MAP[d] ?? -1);
  return shiftDays.includes(dayNum);
}

function getShiftBounds(date: Date, shift: Shift): { start: Date; end: Date } | null {
  if (!isWorkingDay(date, shift)) return null;

  const zoned = toZonedTime(date, shift.timezone);
  const dayStart = startOfDay(zoned);

  const shiftStartLocal = new Date(dayStart);
  shiftStartLocal.setHours(shift.startHour, 0, 0, 0);

  const shiftEndLocal = new Date(dayStart);
  shiftEndLocal.setHours(shift.endHour, 0, 0, 0);

  return {
    start: fromZonedTime(shiftStartLocal, shift.timezone),
    end: fromZonedTime(shiftEndLocal, shift.timezone),
  };
}

function isExcluded(time: Date, exclusions: ExcludedPeriod[]): boolean {
  return exclusions.some(ex => time >= ex.start && time < ex.end);
}

export function calculateWorkingMinutes(
  startDate: Date,
  endDate: Date,
  schedule: WorkSchedule,
  excludedPeriods: ExcludedPeriod[] = [],
): number {
  if (endDate <= startDate) return 0;

  let totalMinutes = 0;
  let current = new Date(startDate);
  const end = new Date(endDate);

  // Iterate day-by-day in the schedule's primary timezone
  const maxDays = MAX_WORKING_DAYS_CAP;
  let dayCount = 0;

  while (current < end && dayCount < maxDays) {
    for (const shift of schedule.shifts) {
      const bounds = getShiftBounds(current, shift);
      if (!bounds) continue;

      const effectiveStart = current > bounds.start ? current : bounds.start;
      const effectiveEnd = end < bounds.end ? end : bounds.end;

      if (effectiveEnd > effectiveStart && !isExcluded(effectiveStart, excludedPeriods)) {
        totalMinutes += differenceInMinutes(effectiveEnd, effectiveStart);
      }
    }

    // Advance to next day in the primary timezone
    const zonedCurrent = toZonedTime(current, schedule.timezone);
    const nextDay = addDays(startOfDay(zonedCurrent), 1);
    current = fromZonedTime(nextDay, schedule.timezone);
    dayCount++;
  }

  return totalMinutes;
}

export function calculateWorkingHours(
  startDate: Date,
  endDate: Date,
  schedule: WorkSchedule,
  excludedPeriods: ExcludedPeriod[] = [],
): number {
  return calculateWorkingMinutes(startDate, endDate, schedule, excludedPeriods) / 60;
}

export function isWithinWorkingHours(date: Date, schedule: WorkSchedule): boolean {
  for (const shift of schedule.shifts) {
    const bounds = getShiftBounds(date, shift);
    if (bounds && date >= bounds.start && date < bounds.end) {
      return true;
    }
  }
  return false;
}

export function getCurrentShift(date: Date, schedule: WorkSchedule): Shift | null {
  for (const shift of schedule.shifts) {
    const bounds = getShiftBounds(date, shift);
    if (bounds && date >= bounds.start && date < bounds.end) {
      return shift;
    }
  }
  return null;
}
