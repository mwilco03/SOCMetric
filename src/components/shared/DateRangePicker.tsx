import React from 'react';
import { useDashboardStore } from '../../store/dashboardStore';

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

export const DateRangePicker: React.FC = () => {
  const { dateRange, setDateRange } = useDashboardStore();

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({ start, end });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex bg-gray-800 rounded-lg p-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset.days)}
            className="px-3 py-1 text-sm text-gray-400 hover:text-gray-200 rounded transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300">
        <span>{formatDate(dateRange.start)}</span>
        <span className="text-gray-500">→</span>
        <span>{formatDate(dateRange.end)}</span>
      </div>
    </div>
  );
};

