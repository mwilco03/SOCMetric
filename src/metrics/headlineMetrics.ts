/** Headline Metrics - Tier 1 KPIs */

import type { JiraIssue } from '../api/types';
import type { WorkSchedule } from './workingHours';
import { calculateWorkingHours } from './workingHours';
import { percentile } from '../utils/statistics';

export interface HeadlineMetrics {
  queueDepth: number;
  netVelocity: number;
  ttftP85: number;
  activeIncidentCount: number;
  oldestIncidentAge: number;
}

export interface TimeSeriesPoint {
  date: string;
  intake: number;
  closed: number;
  netVelocity: number;
}

export function calculateTTFT(
  issue: JiraIssue,
  statusMapping: Record<string, 'queue' | 'active' | 'done'>,
  schedule: WorkSchedule
): number | null {
  const created = new Date(issue.fields.created);
  const changelog = issue.changelog?.histories || [];
  
  // Find first touch - first status change from queue to active
  for (const history of changelog) {
    for (const item of history.items) {
      if (item.field === 'status') {
        const fromClass = statusMapping[item.fromString] || 'queue';
        const toClass = statusMapping[item.toString] || 'queue';
        
        if (fromClass === 'queue' && toClass === 'active') {
          const firstTouch = new Date(history.created);
          return calculateWorkingHours(created, firstTouch, schedule);
        }
      }
    }
  }
  
  return null;
}

export function calculateHeadlineMetrics(
  issues: JiraIssue[],
  irIssues: JiraIssue[],
  statusMapping: Record<string, 'queue' | 'active' | 'done'>,
  schedule: WorkSchedule,
  _dateRange: { start: Date; end: Date }
): HeadlineMetrics {
  // Queue depth - non-done tickets
  const queueDepth = issues.filter(i => {
    const status = i.fields.status.name;
    return statusMapping[status] !== 'done' && !i.fields.resolutiondate;
  }).length;
  
  // Calculate net velocity from time series
  const dailyStats = new Map<string, { intake: number; closed: number }>();
  
  for (const issue of issues) {
    const date = issue.fields.created.split('T')[0];
    const current = dailyStats.get(date) || { intake: 0, closed: 0 };
    current.intake++;
    dailyStats.set(date, current);
    
    if (issue.fields.resolutiondate) {
      const closeDate = issue.fields.resolutiondate.split('T')[0];
      const closeStats = dailyStats.get(closeDate) || { intake: 0, closed: 0 };
      closeStats.closed++;
      dailyStats.set(closeDate, closeStats);
    }
  }
  
  let totalNetVelocity = 0;
  let days = 0;
  dailyStats.forEach((stats) => {
    totalNetVelocity += stats.closed - stats.intake;
    days++;
  });
  
  const netVelocity = days > 0 ? totalNetVelocity / days : 0;
  
  // TTFT P85
  const ttfts: number[] = [];
  for (const issue of issues) {
    const ttft = calculateTTFT(issue, statusMapping, schedule);
    if (ttft !== null) ttfts.push(ttft);
  }
  const ttftP85 = percentile(ttfts, 85);
  
  // Active incidents
  const activeIncidents = irIssues.filter(i => !i.fields.resolutiondate);
  const activeIncidentCount = activeIncidents.length;
  
  let oldestIncidentAge = 0;
  if (activeIncidents.length > 0) {
    const oldest = activeIncidents.reduce((oldest, i) => 
      new Date(i.fields.created) < new Date(oldest.fields.created) ? i : oldest
    );
    oldestIncidentAge = calculateWorkingHours(
      new Date(oldest.fields.created),
      new Date(),
      schedule
    );
  }
  
  return {
    queueDepth,
    netVelocity,
    ttftP85,
    activeIncidentCount,
    oldestIncidentAge,
  };
}

export function calculateTimeSeries(
  issues: JiraIssue[],
  dateRange: { start: Date; end: Date }
): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  const dailyStats = new Map<string, { intake: number; closed: number }>();
  
  // Initialize all dates
  let current = new Date(dateRange.start);
  while (current <= dateRange.end) {
    const dateStr = current.toISOString().split('T')[0];
    dailyStats.set(dateStr, { intake: 0, closed: 0 });
    current.setDate(current.getDate() + 1);
  }
  
  // Count issues
  for (const issue of issues) {
    const date = issue.fields.created.split('T')[0];
    if (dailyStats.has(date)) {
      const stats = dailyStats.get(date);
      if (stats) stats.intake++;
    }

    if (issue.fields.resolutiondate) {
      const closeDate = issue.fields.resolutiondate.split('T')[0];
      if (dailyStats.has(closeDate)) {
        const stats = dailyStats.get(closeDate);
        if (stats) stats.closed++;
      }
    }
  }
  
  // Convert to array
  dailyStats.forEach((stats, date) => {
    points.push({
      date,
      intake: stats.intake,
      closed: stats.closed,
      netVelocity: stats.closed - stats.intake,
    });
  });
  
  return points.sort((a, b) => a.date.localeCompare(b.date));
}


