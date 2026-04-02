import React from 'react';
import { MessageSquare } from 'lucide-react';
import type { DayData } from '../../hooks/useCalendarData';

interface DayCellProps {
  day: DayData;
  isToday: boolean;
  isCurrentMonth: boolean;
  annotation?: string;
  onClick: (day: DayData) => void;
  onContextMenu: (e: React.MouseEvent, day: DayData) => void;
}

export const DayCell: React.FC<DayCellProps> = ({
  day,
  isToday,
  isCurrentMonth,
  annotation,
  onClick,
  onContextMenu,
}) => {
  const dayNum = parseInt(day.date.slice(8, 10), 10);
  const maxBarCount = day.labels.reduce((max, l) => Math.max(max, l.count), 0);

  return (
    <button
      onClick={() => onClick(day)}
      onContextMenu={(e) => onContextMenu(e, day)}
      className={`flex flex-col p-2 min-h-[90px] rounded-lg border transition-colors text-left ${
        isCurrentMonth
          ? 'bg-soc-card border-soc-border hover:border-blue-500/50'
          : 'bg-gray-900/30 border-gray-800/50 text-gray-600'
      } ${isToday ? 'ring-1 ring-blue-500/60' : ''}`}
    >
      {/* Day number + annotation badge + total */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          <span
            className={`text-xs font-medium ${
              isToday
                ? 'bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center'
                : isCurrentMonth
                  ? 'text-gray-300'
                  : 'text-gray-600'
            }`}
          >
            {dayNum}
          </span>
          {annotation && (
            <span title={annotation}>
              <MessageSquare className="w-3 h-3 text-yellow-400" />
            </span>
          )}
        </div>
        {day.total > 0 && (
          <span className={`text-xs font-mono ${isCurrentMonth ? 'text-gray-400' : 'text-gray-600'}`}>
            {day.total}
          </span>
        )}
      </div>

      {/* Annotation preview */}
      {annotation && (
        <p className="text-[10px] text-yellow-400/70 truncate mb-1">{annotation}</p>
      )}

      {/* Stacked label bars */}
      {day.total > 0 && (
        <div className="flex flex-col gap-0.5 flex-1 justify-end">
          {day.labels.map((lb) => (
            <div
              key={lb.label}
              className="h-1.5 rounded-full"
              style={{
                backgroundColor: lb.color,
                width: maxBarCount > 0 ? `${Math.max((lb.count / maxBarCount) * 100, 12)}%` : '0%',
                opacity: isCurrentMonth ? 0.85 : 0.35,
              }}
              title={`${lb.label}: ${lb.count}`}
            />
          ))}
        </div>
      )}
    </button>
  );
};
