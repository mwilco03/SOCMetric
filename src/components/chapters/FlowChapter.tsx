import React from 'react';
import { KPICard } from '../kpi/KPICard';
import { LineChart } from '../charts/LineChart';
import { BarChart } from '../charts/BarChart';
import { LoadingState } from '../shared/LoadingState';
import { useMetrics } from '../../hooks/useMetrics';
import type { ViewMode } from '../../api/types';

interface FlowChapterProps {
  viewMode: ViewMode;
}

export const FlowChapter: React.FC<FlowChapterProps> = ({ viewMode }) => {
  const metrics = useMetrics();

  if (metrics.isLoading) return <LoadingState message="Loading metrics..." />;
  if (metrics.error) return <div className="p-6 text-red-400">Error: {metrics.error}</div>;
  if (metrics.isEmpty) return <div className="p-6 text-gray-400">No data. Select projects and date range.</div>;

  const agg = metrics.leadTimeAgg;
  const decompositionData = agg
    ? [
        {
          name: 'P50',
          queueWait: Number(agg.queueWaitP50.toFixed(1)),
          activeWork: Number(agg.activeWorkP50.toFixed(1)),
          postActiveWait: Number(agg.postActiveWaitP50.toFixed(1)),
        },
        {
          name: 'P85',
          queueWait: Number(agg.queueWaitP85.toFixed(1)),
          activeWork: Number(agg.activeWorkP85.toFixed(1)),
          postActiveWait: Number(agg.postActiveWaitP85.toFixed(1)),
        },
      ]
    : [];

  const postActivePct = agg && agg.postActiveWaitP85 + agg.activeWorkP85 + agg.queueWaitP85 > 0
    ? Math.round((agg.postActiveWaitP85 / (agg.postActiveWaitP85 + agg.activeWorkP85 + agg.queueWaitP85)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">Flow</h2>
        <p className="text-sm text-gray-400 mt-1">
          Lead time decomposition and throughput analysis.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.kpis.flow.map((kpi, index) => (
          <KPICard key={index} data={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineChart
          title="Intake vs Close Rate"
          headline="Daily intake and close rates from real data"
          data={metrics.timeSeries.map((p) => ({ date: p.date, intake: p.intake, closed: p.closed }))}
          lines={[
            { key: 'intake', name: 'Intake', color: '#3b82f6' },
            { key: 'closed', name: 'Closed', color: '#10b981' },
          ]}
          height={280}
        />

        {decompositionData.length > 0 ? (
          <BarChart
            title="Lead Time Decomposition"
            headline={postActivePct > 0
              ? `Post-active wait accounts for ${postActivePct}% of P85 lead time`
              : 'Lead time phase breakdown (hours)'}
            data={decompositionData}
            bars={[
              { key: 'queueWait', name: 'Queue Wait', color: '#f59e0b' },
              { key: 'activeWork', name: 'Active Work', color: '#10b981' },
              { key: 'postActiveWait', name: 'Post-Active Wait', color: '#ef4444' },
            ]}
            height={280}
          />
        ) : (
          <div className="bg-soc-card border border-soc-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-1">Lead Time Decomposition</h3>
            <div className="p-3 bg-gray-800/50 rounded">
              <p className="text-sm text-gray-400">
                No closed tickets with status transitions in the selected date range.
              </p>
            </div>
          </div>
        )}
      </div>

      {viewMode === 'analyst' && (
        <div className="bg-soc-card border border-soc-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Your Flow Metrics</h3>
          <p className="text-sm text-gray-400">
            Individual analyst flow metrics would appear here with opt-in assignee data enabled.
          </p>
        </div>
      )}
    </div>
  );
};
