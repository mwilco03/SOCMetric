import React from 'react';
import {
  LineChart as ReLineChart,
  Line,
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

interface LineConfig {
  key: string;
  name: string;
  color: string;
  strokeDasharray?: string;
}

interface LineChartProps {
  data: DataPoint[];
  lines: LineConfig[];
  title?: string;
  headline?: string;
  height?: number;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  lines,
  title,
  headline,
  height = 300,
}) => {
  return (
    <div className="bg-soc-card border border-soc-border rounded-lg p-4">
      {title && <h3 className="text-sm font-medium text-gray-300 mb-1">{title}</h3>}
      {headline && <p className="text-sm text-gray-400 mb-3">{headline}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <ReLineChart data={data}>
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
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              strokeDasharray={line.strokeDasharray}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
};

