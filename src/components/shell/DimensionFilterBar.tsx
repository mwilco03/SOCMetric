import React, { useState } from 'react';
import { X, Filter } from 'lucide-react';
import { useDashboardStore } from '../../store/dashboardStore';
import { useMetrics } from '../../hooks/useMetrics';
import type { DimensionKey, DimensionFilter } from '../../dimensions/dimensionEngine';

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  priority: 'Priority',
  label: 'Label',
  component: 'Component',
  issueType: 'Issue Type',
  status: 'Status',
};

export const DimensionFilterBar: React.FC = () => {
  const { dimensionFilters, setDimensionFilters } = useDashboardStore();
  const metrics = useMetrics();
  const [showDropdown, setShowDropdown] = useState<DimensionKey | null>(null);

  const availableDimensions = metrics.availableDimensions ?? {};

  if (Object.keys(availableDimensions).length === 0 && dimensionFilters.length === 0) {
    return null;
  }

  const removeFilter = (dimension: DimensionKey, value: string) => {
    const updated = dimensionFilters
      .map((f) => {
        if (f.dimension !== dimension) return f;
        const remaining = f.values.filter((v) => v !== value);
        return remaining.length > 0 ? { ...f, values: remaining } : null;
      })
      .filter(Boolean) as DimensionFilter[];
    setDimensionFilters(updated);
  };

  const addFilter = (dimension: DimensionKey, value: string) => {
    const existing = dimensionFilters.find((f) => f.dimension === dimension);
    if (existing) {
      if (existing.values.includes(value)) return;
      setDimensionFilters(
        dimensionFilters.map((f) =>
          f.dimension === dimension ? { ...f, values: [...f.values, value] } : f,
        ),
      );
    } else {
      setDimensionFilters([...dimensionFilters, { dimension, values: [value] }]);
    }
    setShowDropdown(null);
  };

  const clearAll = () => setDimensionFilters([]);

  return (
    <div className="px-6 py-2 bg-gray-900/50 border-b border-gray-800 flex items-center gap-2 flex-wrap min-h-[36px]">
      <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" />

      {/* Active filter pills */}
      {dimensionFilters.flatMap((f) =>
        f.values.map((v) => (
          <span
            key={`${f.dimension}-${v}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-kpi-blue/20 text-blue-400 rounded"
          >
            <span className="text-blue-500">{DIMENSION_LABELS[f.dimension]}:</span>
            {v}
            <button
              onClick={() => removeFilter(f.dimension, v)}
              className="ml-0.5 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )),
      )}

      {/* Add filter dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(showDropdown ? null : 'priority')}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          + Add filter
        </button>

        {showDropdown && (
          <>
            <div className="fixed inset-0 z-[55]" onClick={() => setShowDropdown(null)} />
            <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[56] min-w-[200px] max-h-64 overflow-y-auto">
              {(Object.keys(DIMENSION_LABELS) as DimensionKey[]).map((dim) => {
                const options = availableDimensions[dim] ?? [];
                if (options.length === 0) return null;
                return (
                  <div key={dim}>
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-800 sticky top-0">
                      {DIMENSION_LABELS[dim]}
                    </div>
                    {options.slice(0, 10).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => addFilter(dim, opt.value)}
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 flex items-center justify-between"
                      >
                        <span>{opt.value}</span>
                        <span className="text-xs text-gray-500">{opt.count}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {dimensionFilters.length > 0 && (
        <button
          onClick={clearAll}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors ml-auto"
        >
          Clear all
        </button>
      )}
    </div>
  );
};
