/** Ticket Aging & Stalled Detection — operates on OPEN tickets */

import type { JiraIssue } from '../types';
import type { WorkSchedule } from './workingHours';
import { calculateWorkingHours } from './workingHours';
import { STALLED_THRESHOLD_HOURS } from '../constants';

export interface AgingBucket {
  label: string;
  minHours: number;
  maxHours: number;
  count: number;
  tickets: string[];
}

export interface StalledTicket {
  issueKey: string;
  summary: string;
  currentStatus: string;
  stalledDurationHours: number;
  lastTransitionDate: Date | null;
}

export const DEFAULT_AGING_BUCKETS = [
  { label: '0–4h', minHours: 0, maxHours: 4 },
  { label: '4–8h', minHours: 4, maxHours: 8 },
  { label: '8–24h', minHours: 8, maxHours: 24 },
  { label: '1–3d', minHours: 24, maxHours: 72 },
  { label: '3–7d', minHours: 72, maxHours: 168 },
  { label: '7d+', minHours: 168, maxHours: Infinity },
];

export function calculateAgingBuckets(
  openIssues: JiraIssue[],
  schedule: WorkSchedule,
  buckets = DEFAULT_AGING_BUCKETS,
): AgingBucket[] {
  const now = new Date();
  const result: AgingBucket[] = buckets.map((b) => ({
    ...b,
    count: 0,
    tickets: [],
  }));

  for (const issue of openIssues) {
    const created = new Date(issue.fields.created);
    const ageHours = calculateWorkingHours(created, now, schedule);

    for (const bucket of result) {
      if (ageHours >= bucket.minHours && ageHours < bucket.maxHours) {
        bucket.count++;
        bucket.tickets.push(issue.key);
        break;
      }
    }
  }

  return result;
}

export function detectStalledTickets(
  openIssues: JiraIssue[],
  schedule: WorkSchedule,
  stalledThresholdHours = STALLED_THRESHOLD_HOURS,
): StalledTicket[] {
  const now = new Date();
  const stalled: StalledTicket[] = [];

  for (const issue of openIssues) {
    const histories = issue.changelog?.histories || [];

    // Find the last status transition
    let lastTransitionDate: Date | null = null;
    for (let i = histories.length - 1; i >= 0; i--) {
      const history = histories[i];
      if (history.items.some((item) => item.field === 'status')) {
        lastTransitionDate = new Date(history.created);
        break;
      }
    }

    // If no transitions, measure from creation
    const referenceDate = lastTransitionDate ?? new Date(issue.fields.created);
    const hoursSinceActivity = calculateWorkingHours(referenceDate, now, schedule);

    if (hoursSinceActivity >= stalledThresholdHours) {
      stalled.push({
        issueKey: issue.key,
        summary: issue.fields.summary,
        currentStatus: issue.fields.status.name,
        stalledDurationHours: hoursSinceActivity,
        lastTransitionDate,
      });
    }
  }

  // Sort by longest stalled first
  stalled.sort((a, b) => b.stalledDurationHours - a.stalledDurationHours);

  return stalled;
}
