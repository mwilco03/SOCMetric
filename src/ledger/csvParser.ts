/** CSV Parser for Ledger Events */

import type { LedgerEvent } from '../store/dashboardStore';

export interface CSVParseResult {
  events: LedgerEvent[];
  errors: Array<{ line: number; message: string }>;
  warnings: Array<{ line: number; message: string }>;
}

const TYPE_ALIASES: Record<string, LedgerEvent['type']> = {
  absence: 'absence',
  out: 'absence',
  pto: 'absence',
  leave: 'absence',
  new_hire: 'new_hire',
  hire: 'new_hire',
  newhire: 'new_hire',
  downtime: 'system_downtime',
  system_downtime: 'system_downtime',
  outage: 'system_downtime',
  rule: 'rule_deployment',
  rule_deployment: 'rule_deployment',
  deploy: 'rule_deployment',
  holiday: 'holiday',
  incident: 'incident',
  ir: 'incident',
  audit: 'audit',
};

function parseDate(value: string): string | null {
  // Accept YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return value;

  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

export function parseCSV(content: string): CSVParseResult {
  const lines = content.trim().split('\n');
  const events: LedgerEvent[] = [];
  const errors: CSVParseResult['errors'] = [];
  const warnings: CSVParseResult['warnings'] = [];

  if (lines.length === 0) {
    errors.push({ line: 0, message: 'Empty CSV' });
    return { events, errors, warnings };
  }

  // Detect header
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('type') || header.includes('date') || header.includes('description');
  const startLine = hasHeader ? 1 : 0;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));

    if (cols.length < 3) {
      errors.push({ line: i + 1, message: `Expected at least 3 columns, got ${cols.length}` });
      continue;
    }

    const [rawType, rawStart, rawEnd, description = '', scope = 'all', shiftName] = cols;

    // Parse type
    const eventType = TYPE_ALIASES[rawType.toLowerCase().replace(/\s+/g, '_')];
    if (!eventType) {
      errors.push({ line: i + 1, message: `Unknown event type: "${rawType}"` });
      continue;
    }

    // Parse dates
    const startDate = parseDate(rawStart);
    if (!startDate) {
      errors.push({ line: i + 1, message: `Invalid start date: "${rawStart}"` });
      continue;
    }

    const endDate = rawEnd ? parseDate(rawEnd) : startDate;
    if (!endDate) {
      errors.push({ line: i + 1, message: `Invalid end date: "${rawEnd}"` });
      continue;
    }

    if (endDate < startDate) {
      warnings.push({ line: i + 1, message: `End date before start date — swapped` });
    }

    const validScopes: LedgerEvent['scope'][] = ['all', 'shift', 'analyst'];
    const parsedScope = validScopes.includes(scope as LedgerEvent['scope'])
      ? (scope as LedgerEvent['scope'])
      : 'all';

    events.push({
      id: `csv-${i}-${Date.now()}`,
      type: eventType,
      startDate: endDate < startDate ? endDate : startDate,
      endDate: endDate < startDate ? startDate : endDate,
      description: description || `${eventType} event`,
      scope: parsedScope,
      shiftName: shiftName || undefined,
    });
  }

  return { events, errors, warnings };
}

export function validateLedgerEvent(event: Partial<LedgerEvent>): string[] {
  const errors: string[] = [];
  if (!event.type) errors.push('Type is required');
  if (!event.startDate) errors.push('Start date is required');
  if (!event.endDate) errors.push('End date is required');
  if (event.startDate && event.endDate && event.endDate < event.startDate) {
    errors.push('End date must be after start date');
  }
  return errors;
}
