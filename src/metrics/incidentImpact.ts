/** Incident Impact — IR window detection, queue cost, surge detection & absorption */

import type { JiraIssue } from '../api/types';
import type { WorkSchedule } from './workingHours';
import type { TimeSeriesPoint } from './headlineMetrics';
import { calculateTTFT } from './headlineMetrics';
import { mean, median, standardDeviation } from '../utils/statistics';
import { SURGE_INTAKE_MULTIPLIER, SURGE_ABSORPTION_CLOSE_RATIO, MIN_SURGE_DETECTION_DAYS } from '../constants';

export interface IncidentWindow {
  incidentKey: string;
  summary: string;
  startDate: string;
  endDate: string;
  durationDays: number;
}

export interface IncidentCost {
  incidentKey: string;
  ttftDuringHours: number;
  ttftBaselineHours: number;
  ttftDegradationPct: number;
  closeRateDuring: number;
  closeRateBaseline: number;
  closeRateDropPct: number;
  estimatedTicketsDisplaced: number;
}

export interface IncidentImpactSummary {
  windows: IncidentWindow[];
  costs: IncidentCost[];
  totalCostHours: number;
  worstIncident: IncidentCost | null;
}

export interface SurgeEvent {
  date: string;
  intake: number;
  medianIntake: number;
  multiplier: number;
}

export interface SurgeAbsorptionResult {
  surgeEvents: SurgeEvent[];
  absorbedCount: number;
  totalCount: number;
  score: number;
}

export function identifyIncidentWindows(irIssues: JiraIssue[]): IncidentWindow[] {
  return irIssues.map((ir) => {
    const start = ir.fields.created.split('T')[0];
    const end = (ir.fields.resolutiondate ?? new Date().toISOString()).split('T')[0];
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const durationDays = Math.max(1, Math.round((endMs - startMs) / (86400000)));
    return {
      incidentKey: ir.key,
      summary: ir.fields.summary,
      startDate: start,
      endDate: end,
      durationDays,
    };
  });
}

export function calculateIncidentCosts(
  windows: IncidentWindow[],
  projectIssues: JiraIssue[],
  timeSeries: TimeSeriesPoint[],
  statusMapping: Record<string, 'queue' | 'active' | 'done'>,
  schedule: WorkSchedule,
): IncidentImpactSummary {
  if (windows.length === 0 || timeSeries.length === 0) {
    return { windows, costs: [], totalCostHours: 0, worstIncident: null };
  }

  // Build set of dates within any IR window
  const irDates = new Set<string>();
  for (const w of windows) {
    for (const point of timeSeries) {
      if (point.date >= w.startDate && point.date <= w.endDate) {
        irDates.add(point.date);
      }
    }
  }

  const outsideIR = timeSeries.filter((p) => !irDates.has(p.date));

  // Baseline close rate
  const baselineCloseRate = outsideIR.length > 0
    ? mean(outsideIR.map((p) => p.closed))
    : mean(timeSeries.map((p) => p.closed));

  // Compute TTFT baseline vs during IR
  const baselineTTFTs: number[] = [];
  const duringTTFTs: number[] = [];

  for (const issue of projectIssues) {
    const ttft = calculateTTFT(issue, statusMapping, schedule);
    if (ttft === null) continue;
    const createdDate = issue.fields.created.split('T')[0];
    if (irDates.has(createdDate)) {
      duringTTFTs.push(ttft);
    } else {
      baselineTTFTs.push(ttft);
    }
  }

  const baselineTTFT = baselineTTFTs.length > 0 ? mean(baselineTTFTs) : 0;
  const duringTTFT = duringTTFTs.length > 0 ? mean(duringTTFTs) : 0;

  // Per-incident costs
  const costs: IncidentCost[] = windows.map((w) => {
    const windowPoints = timeSeries.filter(
      (p) => p.date >= w.startDate && p.date <= w.endDate,
    );
    const closeRateDuring = windowPoints.length > 0
      ? mean(windowPoints.map((p) => p.closed))
      : 0;

    const closeRateDropPct = baselineCloseRate > 0
      ? ((baselineCloseRate - closeRateDuring) / baselineCloseRate) * 100
      : 0;

    const ttftDegradationPct = baselineTTFT > 0
      ? ((duringTTFT - baselineTTFT) / baselineTTFT) * 100
      : 0;

    const estimatedTicketsDisplaced = Math.max(
      0,
      Math.round((baselineCloseRate - closeRateDuring) * w.durationDays),
    );

    return {
      incidentKey: w.incidentKey,
      ttftDuringHours: duringTTFT,
      ttftBaselineHours: baselineTTFT,
      ttftDegradationPct: Math.max(0, ttftDegradationPct),
      closeRateDuring,
      closeRateBaseline: baselineCloseRate,
      closeRateDropPct: Math.max(0, closeRateDropPct),
      estimatedTicketsDisplaced,
    };
  });

  const totalCostHours = costs.reduce(
    (s, c) => s + c.estimatedTicketsDisplaced * (duringTTFT > 0 ? duringTTFT : 1),
    0,
  );

  const worstIncident = costs.length > 0
    ? costs.reduce((worst, c) =>
        c.estimatedTicketsDisplaced > worst.estimatedTicketsDisplaced ? c : worst,
      )
    : null;

  return { windows, costs, totalCostHours, worstIncident };
}

export function detectSurges(
  timeSeries: TimeSeriesPoint[],
  thresholdMultiplier = SURGE_INTAKE_MULTIPLIER,
): SurgeAbsorptionResult {
  if (timeSeries.length < MIN_SURGE_DETECTION_DAYS) {
    return { surgeEvents: [], absorbedCount: 0, totalCount: 0, score: 0 };
  }

  const intakes = timeSeries.map((p) => p.intake);
  const med = median(intakes);
  const sd = standardDeviation(intakes);

  const surgeEvents: SurgeEvent[] = [];

  for (const point of timeSeries) {
    if (point.intake > med * thresholdMultiplier || point.intake > mean(intakes) + 2 * sd) {
      surgeEvents.push({
        date: point.date,
        intake: point.intake,
        medianIntake: med,
        multiplier: med > 0 ? point.intake / med : 0,
      });
    }
  }

  if (surgeEvents.length === 0) {
    return { surgeEvents, absorbedCount: 0, totalCount: 0, score: 1 };
  }

  // Check absorption: did close rate hold within 1 day of each surge?
  let absorbedCount = 0;
  const medianClose = median(timeSeries.map((p) => p.closed));

  for (const surge of surgeEvents) {
    const idx = timeSeries.findIndex((p) => p.date === surge.date);
    if (idx < 0) continue;
    // Check next 1-2 days close rate
    const nextDays = timeSeries.slice(idx, idx + 3);
    const avgClose = mean(nextDays.map((p) => p.closed));
    if (avgClose >= medianClose * SURGE_ABSORPTION_CLOSE_RATIO) {
      absorbedCount++;
    }
  }

  return {
    surgeEvents,
    absorbedCount,
    totalCount: surgeEvents.length,
    score: surgeEvents.length > 0 ? absorbedCount / surgeEvents.length : 1,
  };
}
