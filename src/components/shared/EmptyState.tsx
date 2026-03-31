import React from 'react';
import { CHART_HEIGHT_DEFAULT } from '../../constants';

interface EmptyStateProps {
  title: string;
  message: string;
  /** Match chart height so layout doesn't collapse */
  matchChartHeight?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  matchChartHeight = false,
}) => {
  return (
    <div
      className="bg-soc-card border border-soc-border rounded-lg p-4 flex flex-col"
      style={matchChartHeight ? { minHeight: CHART_HEIGHT_DEFAULT + 48 } : undefined}
    >
      <h3 className="text-sm font-medium text-gray-300">{title}</h3>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
};
