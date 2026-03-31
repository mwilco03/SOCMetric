import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';

interface DataPoint {
  name: string;
  value: number;
  color?: string;
}

interface BarConfig {
  key: string;
  name: string;
  color: string;
}

interface BarChartProps {
  data: Array<Record<string, string | number>>;
  title?: string;
  headline?: string;
  height?: number;
  color?: string;
  horizontal?: boolean;
  bars?: BarConfig[];
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  headline,
  height = 300,
  color = '#3b82f6',
  horizontal = false,
  bars,
}) => {
  return (
    <div className="bg-soc-card border border-soc-border rounded-lg p-4">
      {title && <h3 className="text-sm font-medium text-gray-300 mb-1">{title}</h3>}
      {headline && <p className="text-sm text-gray-400 mb-3">{headline}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <ReBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            type={horizontal ? 'number' : 'category'}
            dataKey={horizontal ? undefined : 'name'}
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis
            type={horizontal ? 'category' : 'number'}
            dataKey={horizontal ? 'name' : undefined}
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            width={horizontal ? 120 : 60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
            }}
            labelStyle={{ color: '#9ca3af' }}
          />
          {bars ? (
            <>
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {bars.map((bar) => (
                <Bar
                  key={bar.key}
                  dataKey={bar.key}
                  name={bar.name}
                  fill={bar.color}
                  stackId="stack"
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </>
          ) : (
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {(data as unknown as DataPoint[]).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || color} />
              ))}
            </Bar>
          )}
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
};
