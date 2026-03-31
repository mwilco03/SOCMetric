/** Statistical utilities for metrics calculations */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = mean(values.map(v => Math.pow(v - m, 2)));
  return Math.sqrt(variance);
}

export function linearRegression(
  points: { x: number; y: number }[]
): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
  const sumY2 = points.reduce((sum, p) => sum + p.y * p.y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const ssTot = sumY2 - (sumY * sumY) / n;
  const ssRes = points.reduce(
    (sum, p) => sum + Math.pow(p.y - (slope * p.x + intercept), 2),
    0
  );
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}

export function detectOutliers(values: number[], threshold = 2): number[] {
  const m = mean(values);
  const sd = standardDeviation(values);
  return values.filter(v => Math.abs(v - m) > threshold * sd);
}

export function computeRollingBaseline(
  values: number[],
): { mean: number; stdDev: number } {
  const m = mean(values);
  const sd = standardDeviation(values);
  return { mean: m, stdDev: sd > 0 ? sd : 1 };
}

export function exponentialSmoothing(
  values: number[],
  alpha = 0.3
): number[] {
  if (values.length === 0) return [];
  const smoothed = [values[0]];
  for (let i = 1; i < values.length; i++) {
    smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
  }
  return smoothed;
}

