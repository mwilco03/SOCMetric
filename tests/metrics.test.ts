import { describe, it, expect } from 'vitest';
import { calculateWorkingHours } from '../src/metrics/workingHours';
import { mean, median, percentile, standardDeviation } from '../src/utils/statistics';
import type { WorkSchedule } from '../src/metrics/workingHours';

const testSchedule: WorkSchedule = {
  timezone: 'America/New_York',
  shifts: [
    {
      name: 'Day',
      timezone: 'America/New_York',
      startHour: 9,
      endHour: 17,
      workDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      baseHeadcount: 1,
    },
  ],
};

describe('Working Hours', () => {
  it('calculates working hours within same day', () => {
    const start = new Date('2024-01-15T10:00:00'); // Monday 10am
    const end = new Date('2024-01-15T14:00:00');   // Monday 2pm
    const hours = calculateWorkingHours(start, end, testSchedule);
    expect(hours).toBe(4);
  });

  it('calculates working hours across multiple days', () => {
    const start = new Date('2024-01-15T10:00:00'); // Monday 10am
    const end = new Date('2024-01-16T11:00:00');   // Tuesday 11am
    const hours = calculateWorkingHours(start, end, testSchedule);
    expect(hours).toBe(9); // 6 hours Monday + 3 hours Tuesday
  });

  it('excludes weekends', () => {
    const start = new Date('2024-01-12T10:00:00'); // Friday 10am
    const end = new Date('2024-01-15T10:00:00');   // Monday 10am
    const hours = calculateWorkingHours(start, end, testSchedule);
    expect(hours).toBe(8); // Friday only, weekend excluded
  });
});

describe('Statistics', () => {
  it('calculates mean', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
    expect(mean([])).toBe(0);
  });

  it('calculates median', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('calculates percentile', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(values, 50)).toBe(5);
    expect(percentile(values, 90)).toBe(9);
  });

  it('calculates standard deviation', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const sd = standardDeviation(values);
    expect(sd).toBeCloseTo(2, 0);
  });
});

