export function getStatusColor(status: 'green' | 'yellow' | 'red' | 'gray'): string {
  const colors = {
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    gray: '#6b7280',
  };
  return colors[status];
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function interpolateColor(
  color1: string,
  color2: string,
  factor: number
): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;

  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);

  return `#${r.toString(16).padStart(2, '0')}${g
    .toString(16)
    .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function generateHeatmapColor(value: number, max: number): string {
  const normalized = Math.min(value / max, 1);
  // Interpolate from green to yellow to red
  if (normalized < 0.5) {
    return interpolateColor('#10b981', '#f59e0b', normalized * 2);
  }
  return interpolateColor('#f59e0b', '#ef4444', (normalized - 0.5) * 2);
}

