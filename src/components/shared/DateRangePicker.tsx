import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useDashboardStore } from '../../store/dashboardStore';

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
];

export const DateRangePicker: React.FC = () => {
  const { dateRange, setDateRange } = useDashboardStore();
  const [showCustom, setShowCustom] = useState(false);

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({ start, end });
    setShowCustom(false);
  };

  const toInputDate = (date: Date) => date.toISOString().split('T')[0];

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="flex items-center gap-2 relative">
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
      <button
        onClick={() => setShowCustom(!showCustom)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300 hover:text-gray-100 transition-colors"
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>{formatDate(dateRange.start)}</span>
        <span className="text-gray-500">→</span>
        <span>{formatDate(dateRange.end)}</span>
      </button>

      {showCustom && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setShowCustom(false)} />
          <div className="absolute top-full right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl z-[56] space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start</label>
              <input
                type="date"
                value={toInputDate(dateRange.start)}
                onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value + 'T00:00:00') })}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End</label>
              <input
                type="date"
                value={toInputDate(dateRange.end)}
                onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value + 'T23:59:59') })}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200"
              />
            </div>
            <button
              onClick={() => setShowCustom(false)}
              className="w-full py-1.5 text-sm bg-kpi-blue text-white rounded hover:bg-blue-600 transition-colors"
            >
              Apply
            </button>
          </div>
        </>
      )}
    </div>
  );
};
