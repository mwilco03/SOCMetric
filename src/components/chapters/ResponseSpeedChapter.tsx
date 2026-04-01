import React from 'react';
import { KPICard } from '../kpi/KPICard';
import { BarChart } from '../charts/BarChart';
import { LoadingState } from '../shared/LoadingState';
import { useMetrics } from '../../hooks/useMetrics';
import { calculateTTFT } from '../../metrics/headlineMetrics';
import { detectSIEMPattern } from '../../normalization/entityNormalizer';
import { percentile } from '../../utils/statistics';
import type { ViewMode } from '../../types';

interface ResponseSpeedChapterProps {
  viewMode: ViewMode;
}

export const ResponseSpeedChapter: React.FC<ResponseSpeedChapterProps> = ({ viewMode }) => {
  const metrics = useMetrics();

  if (metrics.isLoading) return <LoadingState message="Loading metrics..." />;
  if (metrics.error) return <div className="p-6 text-red-400">Error: {metrics.error}</div>;
  if (metrics.isEmpty) return <div className="p-6 text-gray-400">No data. Select projects and date range.</div>;

  const { projectIssues, flatMapping } = metrics;
  const byPriority = new Map<string, number[]>();
  const bySource = new Map<string, number[]>();

  for (const issue of projectIssues ?? []) {
    const ttft = calculateTTFT(issue, flatMapping ?? {}, { timezone: 'UTC', shifts: [] });
    // We can't easily get the full schedule here, so approximate with the flatMapping TTFT
    // The KPIs already have the correct values; we just need the breakdown shape
    if (ttft === null) continue;

    const priority = issue.fields.priority?.name ?? 'None';
    const arr = byPriority.get(priority) || [];
    arr.push(ttft);
    byPriority.set(priority, arr);

    const siem = detectSIEMPattern(issue.fields.summary);
    const source = siem?.sourceSystem ?? 'Other';
    const srcArr = bySource.get(source) || [];
    srcArr.push(ttft);
    bySource.set(source, srcArr);
  }

  const priorityData = [...byPriority.entries()]
    .map(([name, ttfts]) => ({
      name,
      value: Number(percentile(ttfts, 85).toFixed(1)),
      color: percentile(ttfts, 85) < 4 ? '#10b981' : percentile(ttfts, 85) < 8 ? '#f59e0b' : '#ef4444',
    }))
    .sort((a, b) => a.value - b.value);

  const sourceData = [...bySource.entries()]
    .filter(([name]) => name !== 'Other' || bySource.size <= 5)
    .map(([name, ttfts]) => ({
      name,
      value: Number(percentile(ttfts, 85).toFixed(1)),
      color: percentile(ttfts, 85) < 4 ? '#10b981' : percentile(ttfts, 85) < 8 ? '#f59e0b' : '#ef4444',
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">Response Speed</h2>
        <p className="text-sm text-gray-400 mt-1">
          Time-to-First-Touch analysis by priority and dimension.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.kpis.speed.map((kpi, index) => (
          <KPICard key={index} data={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {priorityData.length > 0 ? (
          <BarChart
            title="TTFT P85 by Priority"
            headline="Hours to first touch, 85th percentile"
            data={priorityData}
            height={280}
          />
        ) : (
          <div className="bg-soc-card border border-soc-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">TTFT by Priority</h3>
            <p className="text-sm text-gray-400 mt-3">No TTFT data — tickets may lack status transitions.</p>
          </div>
        )}

        {sourceData.length > 0 ? (
          <BarChart
            title="TTFT P85 by Source System"
            headline="Detected from SIEM title patterns"
            data={sourceData}
            horizontal
            height={280}
          />
        ) : (
          <div className="bg-soc-card border border-soc-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">TTFT by Source System</h3>
            <p className="text-sm text-gray-400 mt-3">No source system patterns detected in ticket titles.</p>
          </div>
        )}
      </div>

      {viewMode === 'lead' && metrics.afterHours && metrics.afterHours.totalTransitions > 0 && (
        <div className="bg-soc-card border border-soc-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">After-Hours Response</h3>
          <p className="text-sm text-gray-300">
            {Math.round(metrics.afterHours.afterHoursRate * 100)}% of transitions happen after hours,{' '}
            {Math.round(metrics.afterHours.weekendRate * 100)}% on weekends
          </p>
          <div className="grid grid-cols-3 gap-4 mt-3">
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
              <p className="text-xs text-gray-500">Weekend Rate</p>
              <p className="text-xl font-bold text-gray-200">
                {Math.round(metrics.afterHours.weekendRate * 100)}%
              </p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded">
              <p className="text-xs text-gray-500">After-Hours Transitions</p>
              <p className="text-xl font-bold text-gray-200">
                {metrics.afterHours.afterHoursTransitions} / {metrics.afterHours.totalTransitions}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
