import React, { useState, useMemo, useCallback } from 'react';
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  format,
} from 'date-fns';
import { CalendarNav } from '../calendar/CalendarNav';
import { CalendarGrid } from '../calendar/CalendarGrid';
import { AnnotationMenu } from '../calendar/AnnotationMenu';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useAnnotations, useSetAnnotation, useDeleteAnnotation } from '../../hooks/useAnnotations';
import { usePanel } from '../panels/PanelContext';
import { LoadingState } from '../shared/LoadingState';
import { CLUSTER_NAME_MAX_LENGTH, CLUSTER_KEYS_PREVIEW_COUNT } from '../../constants';
import type { CalendarViewMode, DayData } from '../../hooks/useCalendarData';

interface ContextMenuState {
  x: number;
  y: number;
  date: string;
}

export const CalendarChapter: React.FC = () => {
  const { days, isLoading, error } = useCalendarData();
  const { data: annotations = {} } = useAnnotations();
  const setAnnotation = useSetAnnotation();
  const deleteAnnotation = useDeleteAnnotation();
  const { openSlideOut } = usePanel();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [showWeekends, setShowWeekends] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>();
    for (const d of days) {
      map.set(d.date, d);
    }
    return map;
  }, [days]);

  const handleNavigate = useCallback(
    (direction: 'back' | 'forward' | 'today') => {
      if (direction === 'today') {
        setCurrentDate(new Date());
        return;
      }
      const delta = direction === 'forward' ? 1 : -1;
      setCurrentDate((prev) => {
        switch (viewMode) {
          case 'month':
            return delta > 0 ? addMonths(prev, 1) : subMonths(prev, 1);
          case 'week':
          case 'workWeek':
            return delta > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1);
          case 'day':
            return delta > 0 ? addDays(prev, 1) : subDays(prev, 1);
        }
      });
    },
    [viewMode],
  );

  const title = useMemo(() => {
    switch (viewMode) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'week':
      case 'workWeek':
        return `Week of ${format(currentDate, 'MMM d, yyyy')}`;
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
    }
  }, [currentDate, viewMode]);

  const handleDayClick = useCallback(
    (day: DayData) => {
      if (day.tickets.length === 0) return;

      const clusters = new Map<string, { count: number; keys: string[] }>();
      for (const t of day.tickets) {
        const normalized = t.summary
          .replace(/\[.*?\]/g, '')
          .replace(/\(.*?\)/g, '')
          .replace(/[:#\-–—]\s.*$/, '')
          .trim()
          .toLowerCase()
          .slice(0, CLUSTER_NAME_MAX_LENGTH);
        const clusterKey = normalized || '(untitled)';
        const existing = clusters.get(clusterKey);
        if (existing) {
          existing.count++;
          existing.keys.push(t.key);
        } else {
          clusters.set(clusterKey, { count: 1, keys: [t.key] });
        }
      }

      const sorted = [...clusters.entries()].sort((a, b) => b[1].count - a[1].count);

      openSlideOut(
        `${format(new Date(day.date + 'T00:00:00'), 'EEEE, MMM d')} — ${day.total} ticket${day.total !== 1 ? 's' : ''}`,
        <div className="space-y-4">
          {day.labels.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">By Label</h3>
              <div className="flex flex-wrap gap-2">
                {day.labels.map((lb) => (
                  <div
                    key={lb.label}
                    className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded text-sm"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: lb.color }}
                    />
                    <span className="text-gray-300">{lb.label}</span>
                    <span className="text-gray-500">{lb.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Clusters ({sorted.length})
            </h3>
            <div className="space-y-2">
              {sorted.map(([name, { count, keys }]) => (
                <div key={name} className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-200 capitalize">{name}</span>
                    <span className="text-xs font-mono text-gray-400">{count}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {keys.slice(0, CLUSTER_KEYS_PREVIEW_COUNT).map((k) => (
                      <span
                        key={k}
                        className="text-xs font-mono text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded"
                      >
                        {k}
                      </span>
                    ))}
                    {keys.length > CLUSTER_KEYS_PREVIEW_COUNT && (
                      <span className="text-xs text-gray-600">+{keys.length - CLUSTER_KEYS_PREVIEW_COUNT} more</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">All Tickets</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-1 px-2 text-xs font-medium text-gray-500">Key</th>
                  <th className="text-left py-1 px-2 text-xs font-medium text-gray-500">Summary</th>
                  <th className="text-left py-1 px-2 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {day.tickets.map((t) => (
                  <tr key={t.id} className="border-b border-gray-800">
                    <td className="py-1 px-2 text-sm font-mono text-gray-300">{t.key}</td>
                    <td className="py-1 px-2 text-sm text-gray-300 truncate max-w-[280px]">
                      {t.summary}
                    </td>
                    <td className="py-1 px-2 text-sm text-gray-400">{t.status_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>,
      );
    },
    [openSlideOut],
  );

  const handleDayContextMenu = useCallback(
    (e: React.MouseEvent, day: DayData) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, date: day.date });
    },
    [],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const legendLabels = useMemo(() => {
    const allLabels = new Map<string, string>();
    for (const d of days) {
      for (const lb of d.labels) {
        if (!allLabels.has(lb.label)) allLabels.set(lb.label, lb.color);
      }
    }
    return [...allLabels.entries()];
  }, [days]);

  if (isLoading) return <LoadingState message="Loading calendar data..." />;
  if (error) return <div className="p-6 text-red-400">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <CalendarNav
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentDate={currentDate}
        onNavigate={handleNavigate}
        showWeekends={showWeekends}
        onToggleWeekends={() => setShowWeekends((v) => !v)}
        title={title}
      />

      <CalendarGrid
        currentDate={currentDate}
        viewMode={viewMode}
        showWeekends={showWeekends}
        dayDataMap={dayDataMap}
        annotations={annotations}
        onDayClick={handleDayClick}
        onDayContextMenu={handleDayContextMenu}
      />

      {/* Annotation context menu */}
      {contextMenu && (
        <AnnotationMenu
          x={contextMenu.x}
          y={contextMenu.y}
          date={contextMenu.date}
          existing={annotations[contextMenu.date]}
          onSave={(date, annotation) => setAnnotation.mutate({ date, annotation })}
          onDelete={(date) => deleteAnnotation.mutate(date)}
          onClose={closeContextMenu}
        />
      )}

      {/* Legend */}
      {legendLabels.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2">
          {legendLabels.map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
