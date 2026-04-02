import React, { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isToday,
  isSameMonth,
  isWeekend,
  format,
} from 'date-fns';
import { DayCell } from './DayCell';
import type { DayData, CalendarViewMode } from '../../hooks/useCalendarData';

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WORKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

interface CalendarGridProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  showWeekends: boolean;
  dayDataMap: Map<string, DayData>;
  annotations: Record<string, string>;
  onDayClick: (day: DayData) => void;
  onDayContextMenu: (e: React.MouseEvent, day: DayData) => void;
}

function emptyDay(date: Date): DayData {
  return {
    date: format(date, 'yyyy-MM-dd'),
    total: 0,
    labels: [],
    tickets: [],
  };
}

function getDaysForView(
  currentDate: Date,
  viewMode: CalendarViewMode,
  showWeekends: boolean,
): Date[] {
  let start: Date;
  let end: Date;

  switch (viewMode) {
    case 'day':
      return [currentDate];

    case 'workWeek': {
      // Monday through Friday of the current week
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
      start = weekStart;
      end = addDays(weekStart, 4); // Friday
      break;
    }

    case 'week': {
      start = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
      end = endOfWeek(currentDate, { weekStartsOn: 0 }); // Saturday
      break;
    }

    case 'month':
    default: {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      start = startOfWeek(monthStart, { weekStartsOn: 0 });
      end = endOfWeek(monthEnd, { weekStartsOn: 0 });
      break;
    }
  }

  const days: Date[] = [];
  let current = new Date(start);
  while (current <= end) {
    if (showWeekends || !isWeekend(current)) {
      days.push(new Date(current));
    }
    current = addDays(current, 1);
  }
  return days;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  viewMode,
  showWeekends,
  dayDataMap,
  annotations,
  onDayClick,
  onDayContextMenu,
}) => {
  const days = useMemo(
    () => getDaysForView(currentDate, viewMode, showWeekends),
    [currentDate, viewMode, showWeekends],
  );

  const headers = viewMode === 'day'
    ? [format(currentDate, 'EEEE')]
    : showWeekends || viewMode === 'week'
      ? WEEKDAY_HEADERS
      : WORKDAY_HEADERS;

  const cols = headers.length;

  return (
    <div>
      {/* Day-of-week headers */}
      <div
        className="grid gap-1 mb-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {headers.map((h) => (
          <div key={h} className="text-center text-xs font-medium text-gray-500 py-1">
            {h}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {days.map((date) => {
          const key = format(date, 'yyyy-MM-dd');
          const dayData = dayDataMap.get(key) ?? emptyDay(date);
          return (
            <DayCell
              key={key}
              day={dayData}
              isToday={isToday(date)}
              isCurrentMonth={viewMode === 'month' ? isSameMonth(date, currentDate) : true}
              annotation={annotations[key]}
              onClick={onDayClick}
              onContextMenu={onDayContextMenu}
            />
          );
        })}
      </div>
    </div>
  );
};
