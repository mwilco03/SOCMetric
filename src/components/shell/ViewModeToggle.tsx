import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ViewMode } from '../../api/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

const modes: { id: ViewMode; label: string; description: string }[] = [
  { id: 'analyst', label: 'Analyst', description: 'Individual queue focus' },
  { id: 'lead', label: 'Lead', description: 'Team performance view' },
  { id: 'executive', label: 'Director', description: 'Strategic overview' },
];

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  mode,
  onChange,
  className,
}) => {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">View Mode</span>
      <div className="flex bg-gray-800 rounded-lg p-1">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={cn(
              'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
              mode === m.id
                ? 'bg-kpi-blue text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            )}
            title={m.description}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
};

