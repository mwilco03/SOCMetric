/** Insight Generator — rule-based narrative insights from computed metrics */

import type { HeadlineMetrics } from '../metrics/headlineMetrics';
import type { LeadTimeAggregate } from '../metrics/leadTimeDecomposition';
import type { StaffingAssessment } from '../metrics/staffingModel';
import type { StalledTicket } from '../metrics/ticketAging';
import type { TicketCluster } from '../metrics/clusterAnalysis';
import type { SurgeAbsorptionResult } from '../metrics/incidentImpact';
import type { ProjectionResult } from '../staffing/projectionEngine';

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  chapter: string;
  text: string;
}

interface InsightInput {
  headline: HeadlineMetrics | null;
  leadTimeAgg: LeadTimeAggregate | null;
  staffing: StaffingAssessment | null;
  stalledTickets: StalledTicket[];
  clusters: TicketCluster[];
  surgeAbsorption: SurgeAbsorptionResult | null;
  projection: ProjectionResult | null;
}

export function generateInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  let id = 0;

  const { headline, leadTimeAgg, staffing, stalledTickets, clusters, surgeAbsorption, projection } = input;

  // --- Watch Status insights ---

  if (headline && headline.netVelocity < -2) {
    insights.push({
      id: String(++id),
      severity: 'critical',
      chapter: 'watch',
      text: `Queue is filling at ${Math.abs(headline.netVelocity).toFixed(1)} tickets/day faster than it drains.`,
    });
  }

  if (headline && headline.activeIncidentCount > 1) {
    insights.push({
      id: String(++id),
      severity: 'critical',
      chapter: 'watch',
      text: `${headline.activeIncidentCount} concurrent incidents active — capacity under pressure.`,
    });
  }

  if (stalledTickets.length > 3) {
    insights.push({
      id: String(++id),
      severity: 'warning',
      chapter: 'watch',
      text: `${stalledTickets.length} tickets stalled with no activity > 48 working hours. Oldest: ${stalledTickets[0].issueKey}.`,
    });
  } else if (stalledTickets.length > 0) {
    insights.push({
      id: String(++id),
      severity: 'info',
      chapter: 'watch',
      text: `${stalledTickets.length} stalled ticket${stalledTickets.length > 1 ? 's' : ''} in queue.`,
    });
  }

  // --- Flow insights ---

  if (leadTimeAgg && leadTimeAgg.flowEfficiency < 30) {
    const postActivePct = leadTimeAgg.postActiveWaitP85 + leadTimeAgg.activeWorkP85 + leadTimeAgg.queueWaitP85 > 0
      ? Math.round((leadTimeAgg.postActiveWaitP85 / (leadTimeAgg.postActiveWaitP85 + leadTimeAgg.activeWorkP85 + leadTimeAgg.queueWaitP85)) * 100)
      : 0;
    insights.push({
      id: String(++id),
      severity: 'warning',
      chapter: 'flow',
      text: `Flow efficiency is only ${leadTimeAgg.flowEfficiency.toFixed(0)}% — ${postActivePct}% of lead time is post-active wait.`,
    });
  }

  if (leadTimeAgg && leadTimeAgg.queueWaitP85 > leadTimeAgg.activeWorkP85 * 3) {
    insights.push({
      id: String(++id),
      severity: 'warning',
      chapter: 'flow',
      text: `Queue wait P85 (${leadTimeAgg.queueWaitP85.toFixed(1)}h) is 3x longer than active work (${leadTimeAgg.activeWorkP85.toFixed(1)}h). Tickets sit before being picked up.`,
    });
  }

  // --- Capacity insights ---

  if (staffing) {
    if (staffing.verdict === 'understaffed') {
      insights.push({
        id: String(++id),
        severity: 'critical',
        chapter: 'capacity',
        text: staffing.narrative,
      });
    } else if (staffing.verdict === 'routing_problem') {
      insights.push({
        id: String(++id),
        severity: 'warning',
        chapter: 'capacity',
        text: staffing.narrative,
      });
    }
  }

  if (surgeAbsorption && surgeAbsorption.totalCount > 0 && surgeAbsorption.score < 0.5) {
    insights.push({
      id: String(++id),
      severity: 'warning',
      chapter: 'capacity',
      text: `Team absorbed only ${surgeAbsorption.absorbedCount} of ${surgeAbsorption.totalCount} surge days — limited burst capacity.`,
    });
  }

  // --- Patterns insights ---

  const criticalClusters = clusters.filter((c) => c.automationTier === 'critical');
  if (criticalClusters.length > 0) {
    const totalHours = criticalClusters.reduce((s, c) => s + c.totalWorkHours, 0);
    insights.push({
      id: String(++id),
      severity: 'critical',
      chapter: 'patterns',
      text: `${criticalClusters.length} cluster${criticalClusters.length > 1 ? 's' : ''} flagged CRITICAL — consuming ${totalHours.toFixed(0)} analyst-hours with persistent recurrence.`,
    });
  }

  const requiredClusters = clusters.filter((c) => c.automationTier === 'required');
  if (requiredClusters.length > 0) {
    insights.push({
      id: String(++id),
      severity: 'warning',
      chapter: 'patterns',
      text: `${requiredClusters.length} cluster${requiredClusters.length > 1 ? 's' : ''} need automation — recurrence rate > 30%.`,
    });
  }

  // --- Projection insights ---

  if (projection && projection.crossoverDate) {
    insights.push({
      id: String(++id),
      severity: 'critical',
      chapter: 'projections',
      text: `Queue projected to double by ${projection.crossoverDate} (~${projection.daysUntilCritical} days) at current trends.`,
    });
  }

  return insights;
}
