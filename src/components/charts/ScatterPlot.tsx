import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  x: number;
  y: number;
  date: string;
}

interface ScatterPlotProps {
  data: DataPoint[];
  title?: string;
  headline?: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
  trendLine?: boolean;
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({
  data,
  title,
  headline,
  xLabel = 'Queue Depth',
  yLabel = 'Close Rate',
  height = 300,
  trendLine = true,
}) => {
  // Calculate trend line
  const calculateTrend = () => {
    if (data.length < 2) return null;
    
    const n = data.length;
    const sumX = data.reduce((sum, p) => sum + p.x, 0);
    const sumY = data.reduce((sum, p) => sum + p.y, 0);
    const sumXY = data.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = data.reduce((sum, p) => sum + p.x * p.x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const minX = Math.min(...data.map(d => d.x));
    const maxX = Math.max(...data.map(d => d.x));
    
    return [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept },
    ];
  };

  const trendData = trendLine ? calculateTrend() : null;

  return (
    <div className="bg-soc-card border border-soc-border rounded-lg p-4">
      {title && <h3 className="text-sm font-medium text-gray-300 mb-1">{title}</h3>}
      {headline && <p className="text-sm text-gray-400 mb-3">{headline}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            label={{ value: xLabel, position: 'bottom', fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            label={{ value: yLabel, angle: -90, position: 'left', fill: '#6b7280', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
            }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value: number, name: string) => [value.toFixed(1), name]}
          />
          <Scatter
            name="Daily Data"
            data={data}
            fill="#3b82f6"
            fillOpacity={0.6}
          />
          {trendData && (
            <Scatter
              name="Trend"
              data={trendData}
              line={{ stroke: '#10b981', strokeWidth: 2 }}
              fill="none"
              shape={() => <svg></svg>}
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};



