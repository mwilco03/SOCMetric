/** Seasonal Decomposition — trend + seasonal + residual
 *
 * Simplified STL-like approach:
 * 1. Extract trend via centered moving average (window = season length)
 * 2. Detrend: subtract trend from original
 * 3. Average detrended values by season position to get seasonal component
 * 4. Residual = original - trend - seasonal
 */

export interface DecomposedSeries {
  dates: string[];
  original: number[];
  trend: number[];
  seasonal: number[];
  residual: number[];
  seasonLength: number;
}

export interface SeasonalProjection {
  dates: string[];
  projected: number[];
  trendProjected: number[];
  seasonalComponent: number[];
  confidenceLower: number[];
  confidenceUpper: number[];
}

/**
 * Centered moving average for trend extraction
 */
function movingAverage(values: number[], window: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  const halfW = Math.floor(window / 2);

  for (let i = halfW; i < values.length - halfW; i++) {
    let sum = 0;
    for (let j = i - halfW; j <= i + halfW; j++) {
      sum += values[j];
    }
    result[i] = sum / window;
  }

  // Fill edges with nearest valid value
  for (let i = 0; i < halfW && i < result.length; i++) {
    result[i] = result[halfW] ?? values[i];
  }
  for (let i = values.length - halfW; i < values.length; i++) {
    result[i] = result[values.length - halfW - 1] ?? values[i];
  }

  return result;
}

/**
 * Decompose a time series into trend + seasonal + residual
 * @param values - daily values
 * @param dates - corresponding date strings
 * @param seasonLength - period in days (7 for weekly, 30 for monthly, 365 for yearly)
 */
export function decompose(
  values: number[],
  dates: string[],
  seasonLength = 7,
): DecomposedSeries {
  if (values.length < seasonLength * 2) {
    // Not enough data for seasonal decomposition — return flat
    return {
      dates,
      original: values,
      trend: values,
      seasonal: new Array(values.length).fill(0),
      residual: new Array(values.length).fill(0),
      seasonLength,
    };
  }

  // Step 1: Extract trend via moving average
  const trend = movingAverage(values, seasonLength);

  // Step 2: Detrend
  const detrended = values.map((v, i) => v - (trend[i] ?? v));

  // Step 3: Average by season position to get seasonal component
  const seasonalAvg: number[] = new Array(seasonLength).fill(0);
  const seasonalCount: number[] = new Array(seasonLength).fill(0);

  for (let i = 0; i < detrended.length; i++) {
    const pos = i % seasonLength;
    if (!isNaN(detrended[i])) {
      seasonalAvg[pos] += detrended[i];
      seasonalCount[pos]++;
    }
  }

  for (let i = 0; i < seasonLength; i++) {
    seasonalAvg[i] = seasonalCount[i] > 0 ? seasonalAvg[i] / seasonalCount[i] : 0;
  }

  // Normalize seasonal to sum to zero
  const seasonalMean = seasonalAvg.reduce((a, b) => a + b, 0) / seasonLength;
  for (let i = 0; i < seasonLength; i++) {
    seasonalAvg[i] -= seasonalMean;
  }

  // Expand seasonal to full length
  const seasonal = values.map((_, i) => seasonalAvg[i % seasonLength]);

  // Step 4: Residual
  const residual = values.map((v, i) => v - (trend[i] ?? v) - seasonal[i]);

  return { dates, original: values, trend, seasonal, residual, seasonLength };
}

/**
 * Project forward using decomposed trend + seasonal pattern
 */
export function projectWithSeasonal(
  decomposed: DecomposedSeries,
  horizonDays: number,
): SeasonalProjection {
  const { trend, seasonal, residual, seasonLength } = decomposed;
  const n = trend.length;

  if (n < 2) {
    return {
      dates: [],
      projected: [],
      trendProjected: [],
      seasonalComponent: [],
      confidenceLower: [],
      confidenceUpper: [],
    };
  }

  // Extrapolate trend linearly from last 30 points (or all if < 30)
  const trendWindow = Math.min(30, n);
  const recentTrend = trend.slice(-trendWindow);
  const trendSlope = recentTrend.length >= 2
    ? (recentTrend[recentTrend.length - 1] - recentTrend[0]) / (recentTrend.length - 1)
    : 0;
  const lastTrend = trend[n - 1];

  // Residual standard deviation for confidence intervals
  const validResiduals = residual.filter((r) => !isNaN(r));
  const residualStd = validResiduals.length > 1
    ? Math.sqrt(validResiduals.reduce((s, r) => s + r * r, 0) / validResiduals.length)
    : 0;

  const lastDate = new Date(decomposed.dates[decomposed.dates.length - 1]);
  const dates: string[] = [];
  const projected: number[] = [];
  const trendProjected: number[] = [];
  const seasonalComponent: number[] = [];
  const confidenceLower: number[] = [];
  const confidenceUpper: number[] = [];

  for (let d = 1; d <= horizonDays; d++) {
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + d);
    dates.push(futureDate.toISOString().split('T')[0]);

    const trendValue = lastTrend + trendSlope * d;
    const seasonalValue = seasonal[(n + d - 1) % seasonLength] ?? 0;
    const projectedValue = Math.max(0, trendValue + seasonalValue);

    // Confidence widens with distance
    const confidenceWidth = residualStd * Math.sqrt(1 + d / n) * 1.96;

    trendProjected.push(Math.round(trendValue * 10) / 10);
    seasonalComponent.push(Math.round(seasonalValue * 10) / 10);
    projected.push(Math.round(projectedValue * 10) / 10);
    confidenceLower.push(Math.max(0, Math.round((projectedValue - confidenceWidth) * 10) / 10));
    confidenceUpper.push(Math.round((projectedValue + confidenceWidth) * 10) / 10);
  }

  return { dates, projected, trendProjected, seasonalComponent, confidenceLower, confidenceUpper };
}
