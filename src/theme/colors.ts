/** Status-to-color mapping for data visualization */

export const STATUS_COLORS = {
  good: '#10b981',    // green-500
  warning: '#f59e0b', // amber-500
  danger: '#ef4444',  // red-500
  info: '#3b82f6',    // blue-500
  neutral: '#6b7280', // gray-500
} as const;

export const CHART_COLORS = {
  intake: '#3b82f6',      // blue
  closed: '#10b981',      // green
  queueWait: '#f59e0b',   // amber
  activeWork: '#10b981',   // green
  postActiveWait: '#ef4444', // red
  projected: '#60a5fa',    // lighter blue
  projectedCapacity: '#34d399', // lighter green
  confidence: '#6b7280',   // gray
  queueDepth: '#f59e0b',  // amber
} as const;

export function statusColor(value: number, yellowThreshold: number, redThreshold: number): string {
  if (value >= redThreshold) return STATUS_COLORS.danger;
  if (value >= yellowThreshold) return STATUS_COLORS.warning;
  return STATUS_COLORS.good;
}

export function velocityColor(value: number): string {
  if (value < 0) return STATUS_COLORS.danger;
  return STATUS_COLORS.good;
}
