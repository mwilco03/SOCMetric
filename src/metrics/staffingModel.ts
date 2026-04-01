/** Staffing Assessment Model */

import type { JiraIssue } from '../types';
import type { WorkSchedule } from './workingHours';
import type { TimeSeriesPoint } from './headlineMetrics';
import { calculateTTFT } from './headlineMetrics';
import { percentile, median as calcMedian } from '../utils/statistics';
import {
  QUEUE_PRESSURE_GROWTH_FACTOR,
  QUEUE_PRESSURE_SHRINK_FACTOR,
  TTFT_TREND_GROWTH_FACTOR,
  TTFT_TREND_SHRINK_FACTOR,
  SURGE_CAPACITY_MULTIPLIER,
  INCIDENT_COST_DROP_THRESHOLD,
} from '../constants';

export interface StaffingSignals {
  queuePressure: 'growing' | 'stable' | 'shrinking';
  ttftTrend: 'improving' | 'stable' | 'degrading';
  hasSurgeCapacity: boolean;
  incidentCostHigh: boolean;
}

export type StaffingVerdict = 
  | 'understaffed'
  | 'routing_problem'
  | 'surge_event'
  | 'healthy'
  | 'overstaffed';

export interface StaffingAssessment {
  verdict: StaffingVerdict;
  signals: StaffingSignals;
  narrative: string;
}

export function calculatePrioritySeparationIndex(
  issues: JiraIssue[],
  statusMapping: Record<string, 'queue' | 'active' | 'done'>,
  schedule: WorkSchedule
): { index: number; isReliable: boolean } {
  const byPriority = new Map<string, number[]>();
  
  for (const issue of issues) {
    const priority = issue.fields.priority?.name || 'None';
    const ttft = calculateTTFT(issue, statusMapping, schedule);
    if (ttft !== null) {
      const arr = byPriority.get(priority) || [];
      arr.push(ttft);
      byPriority.set(priority, arr);
    }
  }
  
  if (byPriority.size < 2) {
    return { index: 0, isReliable: false };
  }
  
  const p85s: number[] = [];
  let minBucketSize = Infinity;
  byPriority.forEach((ttfts) => {
    p85s.push(percentile(ttfts, 85));
    minBucketSize = Math.min(minBucketSize, ttfts.length);
  });

  const maxP85 = Math.max(...p85s);
  const minP85 = Math.min(...p85s);

  const index = maxP85 > 0 ? minP85 / maxP85 : 0;

  return { index, isReliable: minBucketSize >= 5 };
}

export function assessStaffing(
  issues: JiraIssue[],
  irIssues: JiraIssue[],
  statusMapping: Record<string, 'queue' | 'active' | 'done'>,
  schedule: WorkSchedule,
  dateRange: { start: Date; end: Date },
  timeSeries?: TimeSeriesPoint[],
): StaffingAssessment {
  const midPoint = new Date((dateRange.start.getTime() + dateRange.end.getTime()) / 2);

  const firstHalf = issues.filter(i => new Date(i.fields.created) < midPoint);
  const secondHalf = issues.filter(i => new Date(i.fields.created) >= midPoint);

  // Signal 1: Queue pressure
  const firstHalfOpens = firstHalf.filter(i => !i.fields.resolutiondate).length;
  const secondHalfOpens = secondHalf.filter(i => !i.fields.resolutiondate).length;

  let queuePressure: 'growing' | 'stable' | 'shrinking' = 'stable';
  if (secondHalfOpens > firstHalfOpens * QUEUE_PRESSURE_GROWTH_FACTOR) queuePressure = 'growing';
  else if (secondHalfOpens < firstHalfOpens * QUEUE_PRESSURE_SHRINK_FACTOR) queuePressure = 'shrinking';

  // Signal 2: TTFT trend
  const firstHalfTTFTs = firstHalf.map(i => calculateTTFT(i, statusMapping, schedule)).filter(Boolean) as number[];
  const secondHalfTTFTs = secondHalf.map(i => calculateTTFT(i, statusMapping, schedule)).filter(Boolean) as number[];

  const firstP85 = percentile(firstHalfTTFTs, 85);
  const secondP85 = percentile(secondHalfTTFTs, 85);

  let ttftTrend: 'improving' | 'stable' | 'degrading' = 'stable';
  if (secondP85 > firstP85 * TTFT_TREND_GROWTH_FACTOR) ttftTrend = 'degrading';
  else if (secondP85 < firstP85 * TTFT_TREND_SHRINK_FACTOR) ttftTrend = 'improving';

  // Signal 3: Surge capacity — can the team absorb spikes?
  let hasSurgeCapacity = false;
  if (timeSeries && timeSeries.length >= 3) {
    const dailyCloses = timeSeries.map(p => p.closed);
    const medianClose = calcMedian(dailyCloses);
    // Check if any 3-day rolling window has avg close rate > 1.5x median
    for (let i = 0; i <= dailyCloses.length - 3; i++) {
      const windowAvg = (dailyCloses[i] + dailyCloses[i + 1] + dailyCloses[i + 2]) / 3;
      if (windowAvg > medianClose * SURGE_CAPACITY_MULTIPLIER) {
        hasSurgeCapacity = true;
        break;
      }
    }
  }

  // Signal 4: Incident cost — does IR work degrade standard queue?
  let incidentCostHigh = false;
  if (irIssues.length > 0 && timeSeries && timeSeries.length > 0) {
    const irWindows = new Set<string>();
    for (const ir of irIssues) {
      const start = ir.fields.created.split('T')[0];
      const end = (ir.fields.resolutiondate ?? new Date().toISOString()).split('T')[0];
      for (const point of timeSeries) {
        if (point.date >= start && point.date <= end) irWindows.add(point.date);
      }
    }
    const duringIR = timeSeries.filter(p => irWindows.has(p.date));
    const outsideIR = timeSeries.filter(p => !irWindows.has(p.date));
    if (duringIR.length > 0 && outsideIR.length > 0) {
      const avgCloseDuring = duringIR.reduce((s, p) => s + p.closed, 0) / duringIR.length;
      const avgCloseOutside = outsideIR.reduce((s, p) => s + p.closed, 0) / outsideIR.length;
      incidentCostHigh = avgCloseDuring < avgCloseOutside * INCIDENT_COST_DROP_THRESHOLD;
    }
  }

  // 4-signal verdict matrix
  let verdict: StaffingVerdict;
  let narrative: string;

  if (queuePressure === 'growing' && ttftTrend === 'degrading') {
    verdict = 'understaffed';
    narrative = 'Queue depth growing while TTFT degrading indicates coverage gap.';
  } else if (queuePressure === 'growing' && ttftTrend !== 'degrading') {
    verdict = 'routing_problem';
    narrative = 'Queue growing but TTFT stable suggests assignment/routing issue.';
  } else if (queuePressure !== 'growing' && ttftTrend === 'degrading' && incidentCostHigh) {
    verdict = 'surge_event';
    narrative = 'TTFT degrading during incident windows — IR activity taxing standard queue.';
  } else if (queuePressure !== 'growing' && ttftTrend === 'degrading') {
    verdict = 'surge_event';
    narrative = 'TTFT degrading without queue growth suggests transient capacity pressure.';
  } else if (queuePressure === 'shrinking' && ttftTrend === 'improving' && hasSurgeCapacity) {
    verdict = 'overstaffed';
    narrative = 'Queue shrinking, TTFT improving, and surge capacity available — team may be over-resourced.';
  } else if (queuePressure === 'shrinking' && ttftTrend === 'improving') {
    verdict = 'healthy';
    narrative = 'Both queue and TTFT improving — team keeping pace.';
  } else {
    verdict = 'healthy';
    narrative = 'Metrics within normal operating range.';
  }

  return {
    verdict,
    signals: { queuePressure, ttftTrend, hasSurgeCapacity, incidentCostHigh },
    narrative,
  };
}


