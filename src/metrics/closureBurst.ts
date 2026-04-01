/** Closure Burst Detection — flags batch-close events */

import type { JiraIssue } from '../types';
import { BURST_THRESHOLD_COUNT, BURST_WINDOW_MINUTES } from '../constants';

export interface ClosureBurst {
  date: string;
  hour: number;
  count: number;
  tickets: string[];
}

export interface ClosureBurstStats {
  bursts: ClosureBurst[];
  burstCount: number;
  ticketsInBursts: number;
  adjustedCloseCount: number;
}

export function detectClosureBursts(
  issues: JiraIssue[],
  thresholdCount = BURST_THRESHOLD_COUNT,
  windowMinutes = BURST_WINDOW_MINUTES,
): ClosureBurstStats {
  // Get all closed issues with timestamps
  const closedIssues = issues
    .filter((i) => i.fields.resolutiondate)
    .map((i) => ({
      key: i.key,
      closedAt: new Date(i.fields.resolutiondate!),
    }))
    .sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime());

  if (closedIssues.length === 0) {
    return { bursts: [], burstCount: 0, ticketsInBursts: 0, adjustedCloseCount: 0 };
  }

  const bursts: ClosureBurst[] = [];
  const burstTicketKeys = new Set<string>();

  // Sliding window: for each ticket, count how many were closed within windowMinutes
  for (let i = 0; i < closedIssues.length; i++) {
    const windowStart = closedIssues[i].closedAt.getTime();
    const windowEnd = windowStart + windowMinutes * 60 * 1000;

    const windowTickets: string[] = [];
    for (let j = i; j < closedIssues.length && closedIssues[j].closedAt.getTime() <= windowEnd; j++) {
      windowTickets.push(closedIssues[j].key);
    }

    if (windowTickets.length >= thresholdCount) {
      const date = closedIssues[i].closedAt.toISOString().split('T')[0];
      const hour = closedIssues[i].closedAt.getHours();

      // Avoid duplicate overlapping bursts on same date+hour
      const existingBurst = bursts.find((b) => b.date === date && b.hour === hour);
      if (!existingBurst) {
        bursts.push({ date, hour, count: windowTickets.length, tickets: windowTickets });
        for (const key of windowTickets) burstTicketKeys.add(key);
      }
      // Skip past this window
      i += windowTickets.length - 1;
    }
  }

  return {
    bursts,
    burstCount: bursts.length,
    ticketsInBursts: burstTicketKeys.size,
    adjustedCloseCount: closedIssues.length - burstTicketKeys.size,
  };
}
