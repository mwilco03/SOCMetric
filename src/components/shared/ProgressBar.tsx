import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  gray: 'bg-gray-500',
};

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  color = 'blue',
  size = 'md',
  showPercentage = true,
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="space-y-1">
      {(label || showPercentage) && (
        <div className="flex justify-between text-sm">
          {label && <span className="text-gray-400">{label}</span>}
          {showPercentage && (
            <span className="text-gray-500">{percentage.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-700 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${colorClasses[color]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

