import React from 'react';
import { KPICard, type KPIData } from '../kpi/KPICard';
import { BarChart } from '../charts/BarChart';
import { LoadingState } from '../shared/LoadingState';
import { useMetrics } from '../../hooks/useMetrics';
import type { ViewMode } from '../../api/types';
import type { AutomationTier } from '../../metrics/clusterAnalysis';

interface PatternsChapterProps {
  viewMode: ViewMode;
}

const TIER_STYLES: Record<AutomationTier, { bg: string; border: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'CRITICAL' },
  required: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', label: 'REQUIRED' },
  advisory: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', label: 'ADVISORY' },
  none: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', label: '' },
};

export const PatternsChapter: React.FC<PatternsChapterProps> = ({ viewMode }) => {
  const metrics = useMetrics();

  if (metrics.isLoading) return <LoadingState message="Loading metrics..." />;
  if (metrics.error) return <div className="p-6 text-red-400">Error: {metrics.error}</div>;
  if (metrics.isEmpty) return <div className="p-6 text-gray-400">No data. Select projects and date range.</div>;

  const recurrence = metrics.recurrence;
  const wastedWorkRatio = recurrence
    ? Math.round(recurrence.wastedWorkRatio * 100)
    : 0;

  const wastedWorkKPI: KPIData = {
    label: 'Wasted Work Ratio',
    value: wastedWorkRatio,
    formattedValue: `${wastedWorkRatio}%`,
    direction: wastedWorkRatio > 30 ? 'up' : wastedWorkRatio > 15 ? 'flat' : 'down',
    delta: 0,
    formattedDelta: '',
    status: wastedWorkRatio > 40 ? 'red' : wastedWorkRatio > 20 ? 'yellow' : 'green',
    insight: recurrence
      ? `${recurrence.totalRecurrenceWorkHours.toFixed(0)}h of ${recurrence.totalWorkHours.toFixed(0)}h total on recurring tickets`
      : 'No recurrence data',
  };

  const clusters = metrics.clusters ?? [];
  const tieredClusters = clusters.filter((c) => c.automationTier !== 'none');
  const totalClusterHours = clusters.reduce((s, c) => s + c.totalWorkHours, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">Patterns</h2>
        <p className="text-sm text-gray-400 mt-1">
          Cluster analysis and automation opportunities.
        </p>
      </div>

      <div className="max-w-sm">
        <KPICard data={wastedWorkKPI} size="lg" />
      </div>

      {/* Cluster Ranking Table */}
      <div className="bg-soc-card border border-soc-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-1">
          Cluster Ranking (by total capacity consumed)
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          {clusters.length} clusters consuming {totalClusterHours.toFixed(0)} analyst-hours
        </p>

        {clusters.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Cluster</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Tickets</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Hours</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Cycle P85</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Recurrence</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Tier</th>
                </tr>
              </thead>
              <tbody>
                {clusters.slice(0, 15).map((c) => {
                  const tierStyle = TIER_STYLES[c.automationTier];
                  return (
                    <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 px-3 text-sm text-gray-300 max-w-xs truncate">
                        {c.normalizedTitle}
                        <span className="text-xs text-gray-500 ml-2">{c.sourceSystem}</span>
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-400 text-right">{c.totalCount}</td>
                      <td className="py-2 px-3 text-sm text-gray-400 text-right">{c.totalWorkHours.toFixed(0)}</td>
                      <td className="py-2 px-3 text-sm text-gray-400 text-right">{c.cycleTimeP85Hours.toFixed(1)}h</td>
                      <td className="py-2 px-3 text-sm text-gray-400 text-right">{Math.round(c.recurrenceRate * 100)}%</td>
                      <td className="py-2 px-3">
                        {c.automationTier !== 'none' && (
                          <span className={`text-xs px-2 py-0.5 rounded ${tierStyle.bg} ${tierStyle.text}`}>
                            {tierStyle.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {clusters.length > 15 && (
              <p className="text-xs text-gray-500 mt-2">Showing top 15 of {clusters.length} clusters</p>
            )}
          </div>
        ) : (
          <div className="p-3 bg-gray-800/50 rounded">
            <p className="text-sm text-gray-400">
              No clusters detected. Clusters require 2+ tickets with similar normalized titles.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Net Velocity */}
        {(metrics.categoryNetVelocity ?? []).length > 0 ? (
          <BarChart
            title="Category Saturation"
            headline="Net velocity per cluster (most negative = filling fastest)"
            data={metrics.categoryNetVelocity}
            horizontal
            height={280}
          />
        ) : (
          <div className="bg-soc-card border border-soc-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">Category Saturation</h3>
            <div className="mt-3 p-4 bg-gray-800/50 rounded text-sm text-gray-400 text-center">
              No category velocity data available
            </div>
          </div>
        )}

        {/* Automation Candidates */}
        <div className="bg-soc-card border border-soc-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Automation Candidates</h3>

          {tieredClusters.length > 0 ? (
            <div className="space-y-3">
              {tieredClusters.slice(0, 6).map((c) => {
                const tierStyle = TIER_STYLES[c.automationTier];
                return (
                  <div key={c.id} className={`p-3 ${tierStyle.bg} border ${tierStyle.border} rounded`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${tierStyle.text}`}>{tierStyle.label}</span>
                      <span className="text-sm text-gray-300 truncate">{c.normalizedTitle}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {c.totalCount} tickets &middot; {c.totalWorkHours.toFixed(0)}h consumed &middot;{' '}
                      {c.rapidRecurrenceCount > 0
                        ? `${c.rapidRecurrenceCount} rapid recurrences`
                        : `${c.slowRecurrenceCount} slow recurrences`}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              No clusters meet automation tier thresholds.
            </p>
          )}
        </div>
      </div>

      {viewMode === 'analyst' && (() => {
        const topClusters = clusters.slice(0, 5);
        return (
          <div className="bg-soc-card border border-soc-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Top Clusters by Volume</h3>
            {topClusters.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Cluster</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Tickets</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Recurrence</th>
                  </tr>
                </thead>
                <tbody>
                  {topClusters.map((c) => (
                    <tr key={c.id} className="border-b border-gray-800">
                      <td className="py-2 px-3 text-sm text-gray-300 truncate max-w-xs">{c.normalizedTitle}</td>
                      <td className="py-2 px-3 text-sm text-gray-400 text-right">{c.totalCount}</td>
                      <td className="py-2 px-3 text-sm text-gray-400 text-right">{Math.round(c.recurrenceRate * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400">No clusters detected in the selected data.</p>
            )}
          </div>
        );
      })()}
    </div>
  );
};
