/** Projection Engine — seasonal decomposition when data allows, linear fallback */

import type { TimeSeriesPoint } from '../metrics/headlineMetrics';
import { linearRegression, standardDeviation, mean } from '../utils/statistics';
import { decompose, projectWithSeasonal } from './seasonalDecomposition';
import { SEASONAL_MIN_DAYS } from '../constants';

export interface ProjectionPoint {
  date: string;
  isProjected: boolean;
  intake: number;
  capacity: number;
  queueDepth: number;
  confidenceLower: number;
  confidenceUpper: number;
}

export interface ProjectionResult {
  historical: ProjectionPoint[];
  projected: ProjectionPoint[];
  crossoverDate: string | null;
  daysUntilCritical: number | null;
  narrative: string;
}

export interface ScenarioInput {
  label: string;
  type: 'add_analyst' | 'remove_analyst' | 'automate_cluster';
  effectDate: string;
  impactValue: number;
}

export function projectForward(
  timeSeries: TimeSeriesPoint[],
  currentQueueDepth: number,
  horizonDays: number,
  scenarios: ScenarioInput[] = [],
): ProjectionResult {
  if (timeSeries.length < 3) {
    return {
      historical: [],
      projected: [],
      crossoverDate: null,
      daysUntilCritical: null,
      narrative: 'Insufficient data for projection (need at least 3 days).',
    };
  }

  // Use seasonal decomposition when 6+ months of data available
  const useSeasonal = timeSeries.length >= SEASONAL_MIN_DAYS;

  if (useSeasonal) {
    return projectWithSeasonalDecomposition(timeSeries, currentQueueDepth, horizonDays, scenarios);
  }

  // Fit linear regression on intake and close rate
  const intakePoints = timeSeries.map((p, i) => ({ x: i, y: p.intake }));
  const closePoints = timeSeries.map((p, i) => ({ x: i, y: p.closed }));

  const intakeReg = linearRegression(intakePoints);
  const closeReg = linearRegression(closePoints);

  const intakeResiduals = timeSeries.map(
    (p, i) => p.intake - (intakeReg.slope * i + intakeReg.intercept),
  );
  const intakeStdDev = standardDeviation(intakeResiduals);

  // Historical points
  const historical: ProjectionPoint[] = timeSeries.map((p) => ({
    date: p.date,
    isProjected: false,
    intake: p.intake,
    capacity: p.closed,
    queueDepth: 0, // not tracked historically per-day here
    confidenceLower: p.intake,
    confidenceUpper: p.intake,
  }));

  // Project forward
  const lastDate = new Date(timeSeries[timeSeries.length - 1].date);
  const n = timeSeries.length;
  let runningQueueDepth = currentQueueDepth;
  let crossoverDate: string | null = null;
  const projected: ProjectionPoint[] = [];

  // Compute current capacity per analyst (average close rate)
  const avgCloseRate = mean(timeSeries.map((p) => p.closed));

  for (let d = 1; d <= horizonDays; d++) {
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + d);
    const dateStr = futureDate.toISOString().split('T')[0];

    const idx = n + d - 1;
    let projectedIntake = intakeReg.slope * idx + intakeReg.intercept;
    let projectedCapacity = closeReg.slope * idx + closeReg.intercept;

    // Apply scenarios
    for (const scenario of scenarios) {
      if (dateStr >= scenario.effectDate) {
        if (scenario.type === 'add_analyst') {
          projectedCapacity += avgCloseRate * scenario.impactValue;
        } else if (scenario.type === 'remove_analyst') {
          projectedCapacity -= avgCloseRate * scenario.impactValue;
        } else if (scenario.type === 'automate_cluster') {
          projectedIntake *= (1 - scenario.impactValue / 100);
        }
      }
    }

    projectedIntake = Math.max(0, projectedIntake);
    projectedCapacity = Math.max(0, projectedCapacity);

    const netChange = projectedIntake - projectedCapacity;
    runningQueueDepth = Math.max(0, runningQueueDepth + netChange);

    const confidenceWidth = intakeStdDev * Math.sqrt(1 + d / n) * 1.96;

    projected.push({
      date: dateStr,
      isProjected: true,
      intake: Math.round(projectedIntake * 10) / 10,
      capacity: Math.round(projectedCapacity * 10) / 10,
      queueDepth: Math.round(runningQueueDepth),
      confidenceLower: Math.max(0, Math.round((projectedIntake - confidenceWidth) * 10) / 10),
      confidenceUpper: Math.round((projectedIntake + confidenceWidth) * 10) / 10,
    });

    // Detect crossover: queue exceeds 2x current depth
    if (crossoverDate === null && runningQueueDepth > currentQueueDepth * 2) {
      crossoverDate = dateStr;
    }
  }

  const daysUntilCritical = crossoverDate
    ? Math.round((new Date(crossoverDate).getTime() - lastDate.getTime()) / 86400000)
    : null;

  // Generate narrative
  const intakeTrend = intakeReg.slope > 0.1 ? 'rising' : intakeReg.slope < -0.1 ? 'declining' : 'stable';
  const capacityTrend = closeReg.slope > 0.1 ? 'rising' : closeReg.slope < -0.1 ? 'declining' : 'stable';

  let narrative = `Intake trend is ${intakeTrend} (${intakeReg.slope >= 0 ? '+' : ''}${intakeReg.slope.toFixed(2)}/day). `;
  narrative += `Close rate trend is ${capacityTrend} (${closeReg.slope >= 0 ? '+' : ''}${closeReg.slope.toFixed(2)}/day). `;

  if (crossoverDate) {
    narrative += `At current trends, queue will double by ${crossoverDate} (~${daysUntilCritical} days).`;
  } else {
    narrative += `Queue depth is projected to remain manageable over the ${horizonDays}-day horizon.`;
  }

  return {
    historical,
    projected,
    crossoverDate,
    daysUntilCritical,
    narrative,
  };
}

function projectWithSeasonalDecomposition(
  timeSeries: TimeSeriesPoint[],
  currentQueueDepth: number,
  horizonDays: number,
  scenarios: ScenarioInput[],
): ProjectionResult {
  const dates = timeSeries.map((p) => p.date);
  const intakeValues = timeSeries.map((p) => p.intake);
  const closeValues = timeSeries.map((p) => p.closed);

  // Decompose with weekly seasonality (period=7)
  const intakeDecomp = decompose(intakeValues, dates, 7);
  const closeDecomp = decompose(closeValues, dates, 7);

  const intakeProj = projectWithSeasonal(intakeDecomp, horizonDays);
  const closeProj = projectWithSeasonal(closeDecomp, horizonDays);

  // Historical points
  const historical: ProjectionPoint[] = timeSeries.map((p) => ({
    date: p.date,
    isProjected: false,
    intake: p.intake,
    capacity: p.closed,
    queueDepth: 0,
    confidenceLower: p.intake,
    confidenceUpper: p.intake,
  }));

  // Projected points with queue depth tracking
  const avgCloseRate = mean(closeValues);
  let runningQueueDepth = currentQueueDepth;
  let crossoverDate: string | null = null;
  const projected: ProjectionPoint[] = [];

  for (let d = 0; d < horizonDays; d++) {
    let projectedIntake = intakeProj.projected[d] ?? 0;
    let projectedCapacity = closeProj.projected[d] ?? 0;

    // Apply scenarios
    for (const scenario of scenarios) {
      if (intakeProj.dates[d] >= scenario.effectDate) {
        if (scenario.type === 'add_analyst') {
          projectedCapacity += avgCloseRate * scenario.impactValue;
        } else if (scenario.type === 'remove_analyst') {
          projectedCapacity -= avgCloseRate * scenario.impactValue;
        } else if (scenario.type === 'automate_cluster') {
          projectedIntake *= (1 - scenario.impactValue / 100);
        }
      }
    }

    projectedIntake = Math.max(0, projectedIntake);
    projectedCapacity = Math.max(0, projectedCapacity);

    const netChange = projectedIntake - projectedCapacity;
    runningQueueDepth = Math.max(0, runningQueueDepth + netChange);

    if (crossoverDate === null && runningQueueDepth > currentQueueDepth * 2) {
      crossoverDate = intakeProj.dates[d];
    }

    projected.push({
      date: intakeProj.dates[d],
      isProjected: true,
      intake: projectedIntake,
      capacity: projectedCapacity,
      queueDepth: Math.round(runningQueueDepth),
      confidenceLower: intakeProj.confidenceLower[d] ?? 0,
      confidenceUpper: intakeProj.confidenceUpper[d] ?? 0,
    });
  }

  const daysUntilCritical = crossoverDate
    ? Math.round((new Date(crossoverDate).getTime() - new Date(dates[dates.length - 1]).getTime()) / 86400000)
    : null;

  let narrative = `Seasonal decomposition applied (${timeSeries.length} days of history, weekly pattern detected). `;
  if (crossoverDate) {
    narrative += `Queue projected to double by ${crossoverDate} (~${daysUntilCritical} days).`;
  } else {
    narrative += `Queue depth projected to remain manageable over ${horizonDays}-day horizon.`;
  }

  return { historical, projected, crossoverDate, daysUntilCritical, narrative };
}
