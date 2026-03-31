import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface KPITooltip {
  /** Layer 1 (hover): quick context */
  headline: string;
  /** Layer 2 (click): formula/methodology detail */
  detail: string;
  /** Optional: formula expression shown in monospace */
  formula?: string;
  /** Optional: sample size */
  sampleSize?: number;
}

export interface KPIData {
  label: string;
  value: number;
  formattedValue: string;
  direction: 'up' | 'down' | 'flat';
  delta: number;
  formattedDelta: string;
  status: 'green' | 'yellow' | 'red' | 'gray';
  insight: string;
  tooltip?: KPITooltip;
}

interface KPICardProps {
  data: KPIData;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const valueClasses = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-4xl',
};

const statusColors = {
  green: 'text-kpi-green',
  yellow: 'text-kpi-yellow',
  red: 'text-kpi-red',
  gray: 'text-kpi-gray',
};

const badgeColors = {
  green: 'bg-green-500/10 text-green-400',
  yellow: 'bg-yellow-500/10 text-yellow-400',
  red: 'bg-red-500/10 text-red-400',
  gray: 'bg-gray-500/10 text-gray-400',
};

export const KPICard: React.FC<KPICardProps> = ({
  data,
  size = 'md',
  className,
  onClick,
}) => {
  const [showDetail, setShowDetail] = useState(false);

  const ArrowIcon = data.direction === 'up' ? ArrowUp :
                    data.direction === 'down' ? ArrowDown : Minus;

  const hasTooltip = !!data.tooltip;

  const handleClick = (e: React.MouseEvent) => {
    if (hasTooltip) {
      e.stopPropagation();
      setShowDetail((prev) => !prev);
    }
    onClick?.();
  };

  return (
    <div
      className={cn(
        'bg-soc-card border border-soc-border rounded-lg transition-all duration-200 hover:border-gray-500 hover:shadow-lg group relative',
        (onClick || hasTooltip) && 'cursor-pointer',
        sizeClasses[size],
        className
      )}
      onClick={handleClick}
      role={onClick || hasTooltip ? 'button' : undefined}
      tabIndex={onClick || hasTooltip ? 0 : undefined}
      aria-label={`${data.label}: ${data.formattedValue}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-400">{data.label}</span>
          {hasTooltip && (
            <Info className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" />
          )}
        </div>
        <div className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', badgeColors[data.status])}>
          <ArrowIcon className="w-3 h-3 mr-1" />
          {data.formattedDelta}
        </div>
      </div>

      <div className={cn('font-bold tracking-tight mt-2', statusColors[data.status], valueClasses[size])}>
        {data.formattedValue}
      </div>

      <p className="text-sm text-gray-400 mt-1">{data.insight}</p>

      {/* Layer 1: Hover tooltip — quick context */}
      {hasTooltip && !showDetail && (
        <div className="absolute z-[55] left-0 right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="font-semibold text-gray-200 text-sm mb-1">{data.tooltip!.headline}</div>
          {data.tooltip!.sampleSize !== undefined && (
            <div className="text-xs text-gray-500">Sample: {data.tooltip!.sampleSize} tickets</div>
          )}
          <div className="text-xs text-gray-500 mt-1">Click for methodology detail</div>
        </div>
      )}

      {/* Layer 2: Click detail — formula/methodology */}
      {showDetail && data.tooltip && (
        <>
          <div className="fixed inset-0 z-[54]" onClick={(e) => { e.stopPropagation(); setShowDetail(false); }} />
          <div className="absolute z-[55] left-0 right-0 top-full mt-2 bg-gray-900 border border-gray-600 rounded-lg p-4 shadow-2xl">
            <div className="flex items-start justify-between mb-2">
              <div className="font-semibold text-gray-200 text-sm">{data.tooltip.headline}</div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDetail(false); }}
                className="text-gray-500 hover:text-gray-300 text-xs"
                aria-label="Close detail"
              >
                close
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-2">{data.tooltip.detail}</p>
            {data.tooltip.formula && (
              <div className="bg-gray-800 rounded p-2 font-mono text-xs text-gray-300">
                {data.tooltip.formula}
              </div>
            )}
            {data.tooltip.sampleSize !== undefined && (
              <div className="text-xs text-gray-500 mt-2">
                Based on {data.tooltip.sampleSize} tickets in selected range
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
