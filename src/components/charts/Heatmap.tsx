import React from 'react';

interface HeatmapData {
  x: string;
  y: string;
  value: number;
}

interface HeatmapProps {
  data: HeatmapData[];
  xLabels: string[];
  yLabels: string[];
  title?: string;
  headline?: string;
}

export const Heatmap: React.FC<HeatmapProps> = ({
  data,
  xLabels,
  yLabels,
  title,
  headline,
}) => {
  const getColor = (value: number): string => {
    if (value >= 40) return 'bg-red-500';
    if (value >= 20) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getValue = (x: string, y: string): number => {
    const point = data.find((d) => d.x === x && d.y === y);
    return point?.value || 0;
  };

  return (
    <div className="bg-soc-card border border-soc-border rounded-lg p-4">
      {title && <h3 className="text-sm font-medium text-gray-300 mb-1">{title}</h3>}
      {headline && <p className="text-sm text-gray-400 mb-3">{headline}</p>}
      
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Header row */}
          <div className="flex">
            <div className="w-24"></div>
            {xLabels.map((x) => (
              <div key={x} className="w-12 text-center text-xs text-gray-500 py-2">
                {x.slice(0, 3)}
              </div>
            ))}
          </div>
          
          {/* Data rows */}
          {yLabels.map((y) => (
            <div key={y} className="flex items-center">
              <div className="w-24 text-sm text-gray-400 pr-2">{y}</div>
              {xLabels.map((x) => {
                const value = getValue(x, y);
                return (
                  <div
                    key={`${x}-${y}`}
                    className={`w-12 h-10 m-0.5 rounded flex items-center justify-center text-xs font-medium ${
                      value > 0 ? getColor(value) : 'bg-gray-800'
                    } ${value > 0 ? 'text-gray-900' : 'text-gray-600'}`}
                    title={`${y} - ${x}: ${value}%`}
                  >
                    {value > 0 ? `${value}%` : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>&lt; 20%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span>20-40%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>&gt; 40%</span>
        </div>
      </div>
    </div>
  );
};

