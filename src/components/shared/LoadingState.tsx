import React from 'react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Loading...' 
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12">
      <div className="w-8 h-8 border-2 border-kpi-blue border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
};

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-soc-card border border-soc-border rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-1/3 mb-4" />
      <div className="h-8 bg-gray-700 rounded w-1/2 mb-2" />
      <div className="h-4 bg-gray-700 rounded w-2/3" />
    </div>
  );
};

export const SkeletonChart: React.FC = () => {
  return (
    <div className="bg-soc-card border border-soc-border rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-1/4 mb-4" />
      <div className="h-64 bg-gray-700/50 rounded" />
    </div>
  );
};

