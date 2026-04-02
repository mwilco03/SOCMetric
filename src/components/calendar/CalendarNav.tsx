import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarViewMode } from '../../hooks/useCalendarData';

const VIEW_MODES: { id: CalendarViewMode; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'workWeek', label: 'Work Week' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

interface CalendarNavProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  currentDate: Date;
  onNavigate: (direction: 'back' | 'forward' | 'today') => void;
  showWeekends: boolean;
  onToggleWeekends: () => void;
  title: string;
}

export const CalendarNav: React.FC<CalendarNavProps> = ({
  viewMode,
  onViewModeChange,
  onNavigate,
  showWeekends,
  onToggleWeekends,
  title,
}) => {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      {/* Left: navigation arrows + title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onNavigate('back')}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('today')}
            className="px-3 py-1 text-sm text-gray-300 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => onNavigate('forward')}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
      </div>

      {/* Right: view mode toggle + weekend toggle */}
      <div className="flex items-center gap-3">
        {viewMode !== 'day' && (
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showWeekends}
              onChange={onToggleWeekends}
              className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            />
            Weekends
          </label>
        )}
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onViewModeChange(mode.id)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === mode.id
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
