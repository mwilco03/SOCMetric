import React from 'react';
import { LoadingState } from '../shared/LoadingState';
import { useMetrics } from '../../hooks/useMetrics';
import { useDashboardStore } from '../../store/dashboardStore';
import { calculateTTFT } from '../../metrics/headlineMetrics';
import { percentile } from '../../utils/statistics';
import type { ViewMode } from '../../types';

interface CompareChapterProps {
  viewMode: ViewMode;
}

export const CompareChapter: React.FC<CompareChapterProps> = ({ viewMode: _viewMode }) => {
  const metrics = useMetrics();
  const { projectKey, workSchedule } = useDashboardStore();

  if (metrics.isLoading) return <LoadingState message="Loading metrics..." />;
  if (metrics.error) return <div className="p-6 text-red-400">Error: {metrics.error}</div>;
  if (metrics.isEmpty) return <div className="p-6 text-gray-400">No data. Select a project and date range.</div>;

  const allIssues = metrics.projectIssues ?? [];
  const flatMapping = metrics.flatMapping ?? {};
  const selectedProjectKeys = projectKey ? [projectKey] : [];

  // Build per-project comparison rows
  const comparisonRows = selectedProjectKeys.map((key) => {
    const projectIssues = allIssues.filter((i) => i.key.startsWith(key + '-'));
    const openCount = projectIssues.filter((i) => !i.fields.resolutiondate).length;
    const closedCount = projectIssues.filter((i) => i.fields.resolutiondate).length;

    const ttfts = projectIssues
      .map((i) => calculateTTFT(i, flatMapping, workSchedule))
      .filter((t): t is number => t !== null);
    const ttftP85 = percentile(ttfts, 85);

    const velocity = closedCount - projectIssues.length; // negative = queue growing

    return {
      project: key,
      total: projectIssues.length,
      open: openCount,
      closed: closedCount,
      ttftP85,
      ttftStatus: ttftP85 > 8 ? 'red' : ttftP85 > 4 ? 'yellow' : 'green',
      velocity,
      velocityStatus: velocity < -5 ? 'red' : velocity < 0 ? 'yellow' : 'green',
    };
  });

  // Add IR row
  const irIssues = metrics.irIssues ?? [];
  if (irIssues.length > 0) {
    const activeIR = irIssues.filter((i) => !i.fields.resolutiondate).length;
    comparisonRows.push({
      project: 'IR',
      total: irIssues.length,
      open: activeIR,
      closed: irIssues.length - activeIR,
      ttftP85: 0,
      ttftStatus: activeIR > 0 ? 'red' : 'green',
      velocity: -activeIR,
      velocityStatus: activeIR > 2 ? 'red' : activeIR > 0 ? 'yellow' : 'green',
    });
  }

  const badge = (status: string, value: string | number) => {
    const colors: Record<string, string> = {
      green: 'bg-green-500/20 text-green-400',
      yellow: 'bg-yellow-500/20 text-yellow-400',
      red: 'bg-red-500/20 text-red-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-sm font-medium ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {value}
      </span>
    );
  };

  // Cross-project signals from incident impact
  const impact = metrics.incidentImpact;
  const signals: string[] = [];

  if (impact && impact.worstIncident && impact.worstIncident.closeRateDropPct > 10) {
    signals.push(
      `Close rate dropped ${impact.worstIncident.closeRateDropPct.toFixed(0)}% during incident ${impact.worstIncident.incidentKey}.`,
    );
  }
  if (impact && impact.worstIncident && impact.worstIncident.ttftDegradationPct > 10) {
    signals.push(
      `TTFT degraded ${impact.worstIncident.ttftDegradationPct.toFixed(0)}% during IR windows.`,
    );
  }
  if (signals.length === 0) {
    signals.push('No significant cross-project impact detected in current period.');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">Compare</h2>
        <p className="text-sm text-gray-400 mt-1">
          Per-project metrics and cross-project analysis.
        </p>
      </div>

      <div className="bg-soc-card border border-soc-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800/50 border-b border-gray-700">
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Project</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Total</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Open</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Closed</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">TTFT P85</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Net Velocity</th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row) => (
              <tr key={row.project} className="border-b border-gray-700 last:border-0">
                <td className="px-4 py-3 text-sm font-medium text-gray-200">{row.project}</td>
                <td className="px-4 py-3 text-sm text-gray-400 text-right">{row.total}</td>
                <td className="px-4 py-3 text-sm text-gray-400 text-right">{row.open}</td>
                <td className="px-4 py-3 text-sm text-gray-400 text-right">{row.closed}</td>
                <td className="px-4 py-3">{badge(row.ttftStatus, `${row.ttftP85.toFixed(1)}h`)}</td>
                <td className="px-4 py-3">{badge(row.velocityStatus, `${row.velocity > 0 ? '+' : ''}${row.velocity}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-soc-card border border-soc-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Cross-Project Signals</h3>
        <div className="space-y-2">
          {signals.map((signal, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-kpi-blue mt-0.5">-</span>
              <span className="text-gray-400">{signal}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
