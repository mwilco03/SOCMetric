import { useMemo } from 'react';
import { useTickets } from './useJiraData';
import { useDashboardStore } from '../store/dashboardStore';
import { toISODate } from '../utils/dateUtils';
import { MAX_VISIBLE_LABELS } from '../constants';
import type { TicketRow } from '../types';

const LABEL_PALETTE = [
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
];

export interface LabelBreakdown {
  label: string;
  count: number;
  color: string;
}

export interface DayData {
  date: string; // yyyy-MM-dd
  total: number;
  labels: LabelBreakdown[];
  tickets: TicketRow[];
}

export type CalendarViewMode = 'day' | 'workWeek' | 'week' | 'month';

function hashColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
  }
  return LABEL_PALETTE[Math.abs(hash) % LABEL_PALETTE.length];
}

function buildLabelBreakdown(tickets: TicketRow[]): LabelBreakdown[] {
  const counts = new Map<string, number>();
  for (const t of tickets) {
    if (t.labels.length === 0) {
      counts.set('(unlabeled)', (counts.get('(unlabeled)') ?? 0) + 1);
    } else {
      for (const label of t.labels) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const visible = sorted.slice(0, MAX_VISIBLE_LABELS);
  const otherCount = sorted.slice(MAX_VISIBLE_LABELS).reduce((s, [, c]) => s + c, 0);

  const result: LabelBreakdown[] = visible.map(([label, count]) => ({
    label,
    count,
    color: hashColor(label),
  }));

  if (otherCount > 0) {
    result.push({ label: 'other', count: otherCount, color: '#6b7280' });
  }

  return result;
}

export function useCalendarData() {
  const { data: ticketRows, isLoading, error } = useTickets();
  const dateRange = useDashboardStore((s) => s.dateRange);

  const dayMap = useMemo(() => {
    const map = new Map<string, TicketRow[]>();
    if (!ticketRows) return map;

    for (const ticket of ticketRows) {
      const day = ticket.created_at.slice(0, 10); // yyyy-MM-dd
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(ticket);
    }
    return map;
  }, [ticketRows]);

  const days = useMemo((): DayData[] => {
    const result: DayData[] = [];
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const current = new Date(start);

    while (current <= end) {
      const key = toISODate(current);
      const tickets = dayMap.get(key) ?? [];
      result.push({
        date: key,
        total: tickets.length,
        labels: buildLabelBreakdown(tickets),
        tickets,
      });
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [dayMap, dateRange]);

  return { days, isLoading, error: error?.message ?? null };
}
