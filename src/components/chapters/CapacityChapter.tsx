import React from 'react';
import { KPICard } from '../kpi/KPICard';
import { BarChart } from '../charts/BarChart';
import { Heatmap } from '../charts/Heatmap';
import { ScatterPlot } from '../charts/ScatterPlot';
import { LoadingState } from '../shared/LoadingState';
import { useMetrics } from '../../hooks/useMetrics';
import { linearRegression } from '../../utils/statistics';
import type { ViewMode } from '../../types';

interface CapacityChapterProps {
  viewMode: ViewMode;
}

const VERDICT_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  understaffed: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
  routing_problem: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  surge_event: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
  healthy: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
  overstaffed: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
};

export const CapacityChapter: React.FC<CapacityChapterProps> = ({ viewMode }) => {
  const metrics = useMetrics();

  if (metrics.isLoading) return <LoadingState message="Loading metrics..." />;
  if (metrics.error) return <div className="p-6 text-red-400">Error: {metrics.error}</div>;
  if (metrics.isEmpty) return <div className="p-6 text-gray-400">No data. Select projects and date range.</div>;

  const verdictKey = metrics.staffing?.verdict ?? 'healthy';
  const style = VERDICT_STYLES[verdictKey] ?? VERDICT_STYLES.healthy;

  const agingChartData = metrics.agingBuckets.map((b) => ({
    name: b.label,
    value: b.count,
    color: b.count > 10 ? '#ef4444' : b.count > 5 ? '#f59e0b' : '#10b981',
  }));

  const totalOpen = metrics.agingBuckets.reduce((s, b) => s + b.count, 0);
  const oldBucketCount = metrics.agingBuckets
    .filter((b) => b.minHours >= 72)
    .reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">Capacity</h2>
        <p className="text-sm text-gray-400 mt-1">
          Staffing signals, aging, and throughput analysis.
        </p>
      </div>

      {/* Staffing Verdict */}
      {metrics.staffing && (
        <div className={`${style.bg} border ${style.border} rounded-lg p-4`}>
          <div className="flex items-start gap-3">
            <div>
              <span className={`font-medium ${style.text}`}>
                {metrics.staffing.verdict.replace(/_/g, ' ')}
              </span>
              <p className="text-sm text-gray-300 mt-1">
                {metrics.staffing.narrative}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.kpis.capacity.map((kpi, index) => (
          <KPICard key={index} data={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {metrics.rollover && metrics.rollover.heatmapData.length > 0 ? (
          <Heatmap
            title="Rollover Rate by Shift"
            headline={metrics.rollover.byShift.map(
              (s) => `${s.shiftName}: avg ${Math.round(s.avgRolloverRate * 100)}%`,
            ).join(' · ')}
            data={metrics.rollover.heatmapData}
            xLabels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
            yLabels={metrics.rollover.byShift.map((s) => s.shiftName)}
          />
        ) : (
          <div className="bg-soc-card border border-soc-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">Rollover Rate by Shift</h3>
            <div className="mt-3 p-4 bg-gray-800/50 rounded text-sm text-gray-400 text-center">
              No shift data available
            </div>
          </div>
        )}

        {agingChartData.length > 0 ? (
          <BarChart
            title="Ticket Aging Buckets"
            headline={`${totalOpen} open tickets — ${oldBucketCount} older than 3 days`}
            data={agingChartData}
            height={280}
          />
        ) : (
          <div className="bg-soc-card border border-soc-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">Ticket Aging Buckets</h3>
            <div className="mt-3 p-4 bg-gray-800/50 rounded text-sm text-gray-400 text-center">
              No open tickets in queue
            </div>
          </div>
        )}
      </div>

      {/* Stalled Tickets */}
      {metrics.stalledTickets.length > 0 && (
        <div className="bg-soc-card border border-soc-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Stalled Tickets ({metrics.stalledTickets.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Key</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Summary</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Stalled (h)</th>
                </tr>
              </thead>
              <tbody>
                {metrics.stalledTickets.slice(0, 10).map((t) => (
                  <tr key={t.issueKey} className="border-b border-gray-800">
                    <td className="py-2 px-3 text-sm font-mono text-kpi-blue">{t.issueKey}</td>
                    <td className="py-2 px-3 text-sm text-gray-300 truncate max-w-xs">{t.summary}</td>
                    <td className="py-2 px-3 text-sm text-gray-400">{t.currentStatus}</td>
                    <td className="py-2 px-3 text-sm text-red-400 text-right">{t.stalledDurationHours.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {metrics.stalledTickets.length > 10 && (
            <p className="text-xs text-gray-500 mt-2">
              Showing 10 of {metrics.stalledTickets.length} stalled tickets
            </p>
          )}
        </div>
      )}

      {/* Surge Absorption */}
      {metrics.surgeAbsorption && metrics.surgeAbsorption.totalCount > 0 && (
        <div className={`${
          metrics.surgeAbsorption.score >= 0.7
            ? 'bg-green-500/10 border-green-500/30'
            : metrics.surgeAbsorption.score >= 0.4
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-red-500/10 border-red-500/30'
        } border rounded-lg p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-300">Surge Absorption</h3>
              <p className="text-sm text-gray-400 mt-1">
                {metrics.surgeAbsorption.absorbedCount} of {metrics.surgeAbsorption.totalCount} surge
                day{metrics.surgeAbsorption.totalCount !== 1 ? 's' : ''} absorbed
                (close rate held within 70% of median)
              </p>
            </div>
            <span className={`text-2xl font-bold ${
              metrics.surgeAbsorption.score >= 0.7 ? 'text-green-400'
                : metrics.surgeAbsorption.score >= 0.4 ? 'text-yellow-400'
                  : 'text-red-400'
            }`}>
              {Math.round(metrics.surgeAbsorption.score * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Velocity Under Load */}
      {metrics.velocityUnderLoad.length > 0 && (
        <ScatterPlot
          title="Velocity Under Load"
          headline={(() => {
            const points = metrics.velocityUnderLoad.map((p) => ({ x: p.queueDepth, y: p.closeRate }));
            if (points.length < 2) return 'Insufficient data for trend analysis';
            const reg = linearRegression(points);
            const trend = reg.slope > 0.05 ? 'rises' : reg.slope < -0.05 ? 'falls' : 'holds steady';
            return `Close rate ${trend} as queue grows (slope: ${reg.slope.toFixed(2)}, R²: ${reg.r2.toFixed(2)})`;
          })()}
          data={metrics.velocityUnderLoad.map((p) => ({
            x: p.queueDepth,
            y: p.closeRate,
            date: p.date,
          }))}
          xLabel="Queue Depth"
          yLabel="Close Rate"
          height={300}
          trendLine
        />
      )}

      {/* After-Hours Activity */}
      {viewMode === 'lead' && metrics.afterHours && metrics.afterHours.totalTransitions > 0 && (
        <div className="bg-soc-card border border-soc-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">After-Hours Activity</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-gray-800/50 rounded">
              <p className="text-xs text-gray-500">After-Hours Rate</p>
              <p className={`text-xl font-bold ${
                metrics.afterHours.afterHoursRate > 0.2 ? 'text-red-400'
                  : metrics.afterHours.afterHoursRate > 0.1 ? 'text-yellow-400'
                    : 'text-green-400'
              }`}>
                {Math.round(metrics.afterHours.afterHoursRate * 100)}%
              </p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded">
              <p className="text-xs text-gray-500">Weekend Transitions</p>
              <p className="text-xl font-bold text-gray-200">{metrics.afterHours.weekendTransitions}</p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded">
              <p className="text-xs text-gray-500">After-Hours Total</p>
              <p className="text-xl font-bold text-gray-200">
                {metrics.afterHours.afterHoursTransitions} / {metrics.afterHours.totalTransitions}
              </p>
            </div>
          </div>
          {metrics.afterHours.afterHoursRate > 0.15 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-yellow-400">
              {Math.round(metrics.afterHours.afterHoursRate * 100)}% of status transitions happen outside working hours — potential burnout signal.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
