import React, { useState, useMemo } from 'react';
import { LineChart } from '../charts/LineChart';
import { LoadingState } from '../shared/LoadingState';
import { useMetrics } from '../../hooks/useMetrics';
import { projectForward } from '../../staffing/projectionEngine';
import type { ScenarioInput } from '../../staffing/projectionEngine';
import type { ViewMode } from '../../api/types';

interface ProjectionsChapterProps {
  viewMode: ViewMode;
}

const PROJECTION_HORIZONS = [30, 60, 90];

export const ProjectionsChapter: React.FC<ProjectionsChapterProps> = ({ viewMode }) => {
  const [horizon, setHorizon] = useState(60);
  const [scenarios, setScenarios] = useState<ScenarioInput[]>([]);
  const metrics = useMetrics();

  // Recompute projection when horizon or scenarios change
  const projection = useMemo(() => {
    if (!metrics.headline || metrics.timeSeries.length < 3) return metrics.projection;
    return projectForward(metrics.timeSeries, metrics.headline.queueDepth, horizon, scenarios);
  }, [metrics.timeSeries, metrics.headline, horizon, scenarios, metrics.projection]);

  if (metrics.isLoading) return <LoadingState message="Loading metrics..." />;
  if (metrics.error) return <div className="p-6 text-red-400">Error: {metrics.error}</div>;
  if (metrics.isEmpty) return <div className="p-6 text-gray-400">No data. Select projects and date range.</div>;

  // Build chart data: historical + projected
  const chartData = [
    ...metrics.timeSeries.map((p) => ({
      date: p.date,
      intake: p.intake,
      closed: p.closed,
      projectedIntake: null as number | null,
      projectedCapacity: null as number | null,
    })),
    ...(projection?.projected ?? []).map((p) => ({
      date: p.date,
      intake: null as number | null,
      closed: null as number | null,
      projectedIntake: p.intake,
      projectedCapacity: p.capacity,
    })),
  ];

  const queueDepthData = (projection?.projected ?? []).map((p) => ({
    date: p.date,
    queueDepth: p.queueDepth,
    lower: p.confidenceLower,
    upper: p.confidenceUpper,
  })) as unknown as Array<{ date: string; [key: string]: string | number }>;

  const addScenario = (type: ScenarioInput['type'], label: string, impactValue: number) => {
    const effectDate = projection?.projected?.[0]?.date ?? new Date().toISOString().split('T')[0];
    setScenarios((prev) => [...prev, { label, type, effectDate, impactValue }]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">Projections</h2>
          <p className="text-sm text-gray-400 mt-1">
            Forward-looking intake and capacity analysis.
          </p>
        </div>
        <div className="flex gap-2">
          {PROJECTION_HORIZONS.map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                horizon === h
                  ? 'bg-kpi-blue text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {h}d
            </button>
          ))}
        </div>
      </div>

      {/* Narrative */}
      {projection && (
        <div className={`${
          projection.crossoverDate
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-green-500/10 border-green-500/30'
        } border rounded-lg p-4`}>
          <p className="text-sm text-gray-300">{projection.narrative}</p>
          {projection.crossoverDate && (
            <p className="text-sm text-red-400 mt-2 font-medium">
              Queue projected to double by {projection.crossoverDate} ({projection.daysUntilCritical} days)
            </p>
          )}
        </div>
      )}

      {/* Intake vs Capacity Projection */}
      <div className="bg-soc-card border border-soc-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-300">Intake vs Capacity</h3>
          <span className="text-xs text-gray-500">
            Solid = historical &middot; Dashed = projected
          </span>
        </div>
        <div className="h-80">
          <LineChart
            data={chartData}
            lines={[
              { key: 'intake', name: 'Intake (actual)', color: '#3b82f6' },
              { key: 'closed', name: 'Closed (actual)', color: '#10b981' },
              { key: 'projectedIntake', name: 'Intake (projected)', color: '#60a5fa', strokeDasharray: '5 5' },
              { key: 'projectedCapacity', name: 'Capacity (projected)', color: '#34d399', strokeDasharray: '5 5' },
            ]}
            height={320}
          />
        </div>
      </div>

      {/* Queue Depth Projection */}
      {queueDepthData.length > 0 && (
        <div className="bg-soc-card border border-soc-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Projected Queue Depth</h3>
          <div className="h-64">
            <LineChart
              data={queueDepthData}
              lines={[
                { key: 'queueDepth', name: 'Queue Depth', color: '#f59e0b' },
                { key: 'upper', name: '95% Upper', color: '#6b7280', strokeDasharray: '3 3' },
                { key: 'lower', name: '95% Lower', color: '#6b7280', strokeDasharray: '3 3' },
              ]}
              height={256}
            />
          </div>
        </div>
      )}

      {/* Scenario Planner */}
      {viewMode === 'executive' && (
        <div className="bg-soc-card border border-soc-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Scenario Planner</h3>

          {scenarios.length > 0 && (
            <div className="mb-4 space-y-2">
              {scenarios.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                  <span className="text-sm text-gray-300">{s.label}</span>
                  <button
                    onClick={() => setScenarios((prev) => prev.filter((_, j) => j !== i))}
                    className="text-xs text-gray-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => addScenario('add_analyst', 'Add 1 analyst', 1)}
              className="px-3 py-1.5 text-sm bg-green-500/10 text-green-400 border border-green-500/30 rounded hover:bg-green-500/20 transition-colors"
            >
              + Add 1 analyst
            </button>
            <button
              onClick={() => addScenario('remove_analyst', 'Remove 1 analyst', 1)}
              className="px-3 py-1.5 text-sm bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
            >
              - Remove 1 analyst
            </button>
            <button
              onClick={() => addScenario('automate_cluster', 'Automate top cluster (20% intake reduction)', 20)}
              className="px-3 py-1.5 text-sm bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/20 transition-colors"
            >
              Automate top cluster
            </button>
            {scenarios.length > 0 && (
              <button
                onClick={() => setScenarios([])}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
