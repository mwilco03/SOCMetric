import React from 'react';
import {
  AreaChart as ReAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  date: string;
  [key: string]: number | string | null;
}

interface AreaConfig {
  key: string;
  name: string;
  color: string;
  stackId?: string;
}

interface AreaChartProps {
  data: DataPoint[];
  areas: AreaConfig[];
  title?: string;
  headline?: string;
  height?: number;
  stacked?: boolean;
}

export const AreaChart: React.FC<AreaChartProps> = ({
  data,
  areas,
  title,
  headline,
  height = 300,
  stacked = true,
}) => {
  return (
    <div className="bg-soc-card border border-soc-border rounded-lg p-4">
      {title && <h3 className="text-sm font-medium text-gray-300 mb-1">{title}</h3>}
      {headline && <p className="text-sm text-gray-400 mb-3">{headline}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <ReAreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
            }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af' }} />
          {areas.map((area) => (
            <Area
              key={area.key}
              type="monotone"
              dataKey={area.key}
              name={area.name}
              stroke={area.color}
              fill={area.color}
              fillOpacity={0.3}
              stackId={stacked ? '1' : undefined}
            />
          ))}
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  );
};

