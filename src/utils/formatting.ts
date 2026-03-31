/** Formatting utilities for display values */

export function formatDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours < 1) {
    return `${days}d`;
  }
  return `${days}d ${Math.floor(remainingHours)}h`;
}

export function formatNumber(num: number, decimals = 1): string {
  if (Math.abs(num) >= 1000000) {
    return `${(num / 1000000).toFixed(decimals)}M`;
  }
  if (Math.abs(num) >= 1000) {
    return `${(num / 1000).toFixed(decimals)}k`;
  }
  return num.toFixed(decimals);
}

export function formatPercentage(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export function formatDateRange(start: Date, end: Date): string {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

export function formatTicketCount(count: number): string {
  if (count === 0) return 'No tickets';
  if (count === 1) return '1 ticket';
  return `${count} tickets`;
}

