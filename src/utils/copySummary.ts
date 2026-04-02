import { toISODate } from './dateUtils';
import type { KPIData } from '../components/kpi/KPICard';

interface SummaryInput {
  projectKey: string | null;
  dateRange: { start: Date; end: Date };
  kpis: {
    watch: KPIData[];
    flow: KPIData[];
    speed: KPIData[];
    capacity: KPIData[];
  };
  stalledCount: number;
  insights: Array<{ severity: string; text: string }>;
}

function statusIcon(status: KPIData['status']): string {
  switch (status) {
    case 'green': return '[OK]';
    case 'yellow': return '[WARN]';
    case 'red': return '[CRIT]';
    default: return '[--]';
  }
}

function formatSection(title: string, kpis: KPIData[]): string {
  if (kpis.length === 0) return '';
  const lines = kpis.map(
    (k) => `  ${statusIcon(k.status)} ${k.label}: ${k.formattedValue} (${k.formattedDelta})`,
  );
  return `### ${title}\n${lines.join('\n')}`;
}

export function buildSummaryMarkdown(input: SummaryInput): string {
  const { projectKey, dateRange, kpis, stalledCount, insights } = input;
  const header = `## SOC Dashboard Summary — ${projectKey ?? 'No Project'}\n**${toISODate(dateRange.start)}** to **${toISODate(dateRange.end)}**`;

  const sections = [
    formatSection('Watch Status', kpis.watch),
    formatSection('Flow', kpis.flow),
    formatSection('Response Speed', kpis.speed),
    formatSection('Capacity', kpis.capacity),
  ].filter(Boolean);

  const parts = [header, ...sections];

  if (stalledCount > 0) {
    parts.push(`**Stalled tickets:** ${stalledCount}`);
  }

  const critical = insights.filter((i) => i.severity === 'critical' || i.severity === 'warning');
  if (critical.length > 0) {
    parts.push(`### Attention\n${critical.map((i) => `- ${i.text}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

export function buildSummaryPlainText(input: SummaryInput): string {
  return buildSummaryMarkdown(input)
    .replace(/#{1,3}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\[([A-Z]+)\]/g, '($1)');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function copySummaryToClipboard(input: SummaryInput): Promise<void> {
  const markdown = buildSummaryMarkdown(input);
  const plain = buildSummaryPlainText(input);

  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem({
      'text/html': new Blob([`<pre>${escapeHtml(markdown)}</pre>`], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
  } else {
    await navigator.clipboard.writeText(plain);
  }
}
