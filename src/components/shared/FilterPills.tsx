import React from 'react';
import { X } from 'lucide-react';

interface FilterPill {
  id: string;
  label: string;
  value: string;
}

interface FilterPillsProps {
  filters: FilterPill[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export const FilterPills: React.FC<FilterPillsProps> = ({
  filters,
  onRemove,
  onClearAll,
}) => {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <span
          key={filter.id}
          className="inline-flex items-center gap-1 px-3 py-1 bg-gray-800 text-sm text-gray-300 rounded-full"
        >
          <span className="text-gray-500">{filter.label}:</span>
          <span>{filter.value}</span>
          <button
            onClick={() => onRemove(filter.id)}
            className="ml-1 text-gray-500 hover:text-gray-300"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-sm text-gray-500 hover:text-gray-300 underline"
      >
        Clear all
      </button>
    </div>
  );
};

