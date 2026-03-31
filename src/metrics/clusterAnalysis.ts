/** Cluster Analysis — title normalization grouping, work-hour ranking, automation tiers */

import type { JiraIssue } from '../api/types';
import type { WorkSchedule } from './workingHours';
import { calculateWorkingHours } from './workingHours';
import { normalizeTitle, detectSIEMPattern } from '../normalization/entityNormalizer';
import { detectRecurrence, type RecurrenceConfig, DEFAULT_RECURRENCE_CONFIG } from '../patterns/recurrenceEngine';
import { percentile } from '../utils/statistics';
import { CLUSTER_RECURRENCE_CRITICAL_RATE, CLUSTER_RECURRENCE_REQUIRED_RATE } from '../constants';

export type AutomationTier = 'critical' | 'required' | 'advisory' | 'none';

export interface TicketCluster {
  id: string;
  normalizedTitle: string;
  sourceSystem: string;
  tickets: string[];
  totalCount: number;
  totalWorkHours: number;
  avgCycleTimeHours: number;
  cycleTimeP85Hours: number;
  rapidRecurrenceCount: number;
  slowRecurrenceCount: number;
  recurrenceRate: number;
  netVelocity: number;
  automationTier: AutomationTier;
}

export function buildClusters(
  issues: JiraIssue[],
  schedule: WorkSchedule,
  _statusMapping: Record<string, 'queue' | 'active' | 'done'>,
  recurrenceConfig: RecurrenceConfig = DEFAULT_RECURRENCE_CONFIG,
): TicketCluster[] {
  // Group by normalized title
  const groups = new Map<string, JiraIssue[]>();

  for (const issue of issues) {
    const { normalized } = normalizeTitle(issue.fields.summary);
    const existing = groups.get(normalized) || [];
    existing.push(issue);
    groups.set(normalized, existing);
  }
  const clusters: TicketCluster[] = [];

  groups.forEach((clusterIssues, normalizedTitle) => {
    // Skip singleton clusters
    if (clusterIssues.length < 2) return;

    const siem = detectSIEMPattern(clusterIssues[0].fields.summary);
    const sourceSystem = siem?.sourceSystem ?? 'Unknown';

    // Compute per-issue cycle times in working hours
    const cycleTimes: number[] = [];
    let totalWorkHours = 0;

    for (const issue of clusterIssues) {
      const created = new Date(issue.fields.created);
      const resolved = issue.fields.resolutiondate
        ? new Date(issue.fields.resolutiondate)
        : new Date();
      const hours = calculateWorkingHours(created, resolved, schedule);
      cycleTimes.push(hours);
      totalWorkHours += hours;
    }

    const avgCycleTime = cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : 0;
    const cycleTimeP85 = percentile(cycleTimes, 85);

    // Recurrence detection within this cluster
    let rapidCount = 0;
    let slowCount = 0;
    const clusterClosed = clusterIssues.filter((i) => i.fields.resolutiondate);

    for (const issue of clusterIssues) {
      const priorClosed = clusterClosed.filter(
        (c) => new Date(c.fields.resolutiondate!) < new Date(issue.fields.created),
      );
      if (priorClosed.length === 0) continue;
      const result = detectRecurrence(issue, priorClosed, schedule, recurrenceConfig);
      if (result.type === 'rapid') rapidCount++;
      else if (result.type === 'slow') slowCount++;
    }

    const recurrenceRate = clusterIssues.length > 0
      ? (rapidCount + slowCount) / clusterIssues.length
      : 0;

    // Net velocity: close rate minus open rate as a ratio
    const closedCount = clusterIssues.filter((i) => i.fields.resolutiondate).length;
    const openCount = clusterIssues.length - closedCount;
    const netVelocity = closedCount - openCount; // positive = draining, negative = filling

    clusters.push({
      id: normalizedTitle.slice(0, 40),
      normalizedTitle,
      sourceSystem,
      tickets: clusterIssues.map((i) => i.key),
      totalCount: clusterIssues.length,
      totalWorkHours,
      avgCycleTimeHours: avgCycleTime,
      cycleTimeP85Hours: cycleTimeP85,
      rapidRecurrenceCount: rapidCount,
      slowRecurrenceCount: slowCount,
      recurrenceRate,
      netVelocity,
      automationTier: 'none', // assigned below
    });
  });

  // Sort by total work hours descending
  clusters.sort((a, b) => b.totalWorkHours - a.totalWorkHours);

  // Assign automation tiers
  assignAutomationTiers(clusters);

  return clusters;
}

function assignAutomationTiers(clusters: TicketCluster[]): void {
  if (clusters.length === 0) return;

  // Top quartile by work hours = eligible for critical
  const topQuartileThreshold = clusters.length >= 4
    ? clusters[Math.floor(clusters.length / 4)].totalWorkHours
    : clusters[0].totalWorkHours;

  for (const cluster of clusters) {
    if (
      cluster.totalWorkHours >= topQuartileThreshold &&
      cluster.recurrenceRate > CLUSTER_RECURRENCE_CRITICAL_RATE
    ) {
      cluster.automationTier = 'critical';
    } else if (cluster.recurrenceRate > CLUSTER_RECURRENCE_REQUIRED_RATE) {
      cluster.automationTier = 'required';
    } else if (cluster.rapidRecurrenceCount > 0 || cluster.slowRecurrenceCount > 0) {
      cluster.automationTier = 'advisory';
    }
  }
}

export function calculateCategoryNetVelocity(
  clusters: TicketCluster[],
): Array<{ name: string; value: number; color: string }> {
  return clusters
    .filter((c) => c.netVelocity !== 0)
    .sort((a, b) => a.netVelocity - b.netVelocity)
    .slice(0, 10)
    .map((c) => ({
      name: c.normalizedTitle.length > 30
        ? c.normalizedTitle.slice(0, 27) + '...'
        : c.normalizedTitle,
      value: c.netVelocity,
      color: c.netVelocity < 0 ? '#ef4444' : '#10b981',
    }));
}
