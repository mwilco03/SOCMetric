import { format, addDays, startOfDay, isWeekend, getDay } from 'date-fns';

export function getBusinessDays(start: Date, end: Date): number {
  let count = 0;
  let current = new Date(start);
  
  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current = addDays(current, 1);
  }
  
  return count;
}

export function getDateRangeArray(start: Date, end: Date): Date[] {
  if (start > end) return [];
  const dates: Date[] = [];
  let current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    current = addDays(current, 1);
  }
  
  return dates;
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getWeekStart(date: Date): Date {
  const day = getDay(date);
  return addDays(startOfDay(date), -day);
}

export function groupByWeek<T>(
  items: T[],
  getDate: (item: T) => Date
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  
  for (const item of items) {
    const weekStart = getWeekStart(getDate(item));
    const key = toISODate(weekStart);
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  
  return groups;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

