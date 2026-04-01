import React from 'react';
import { KPICard } from '../kpi/KPICard';
import { LoadingState } from '../shared/LoadingState';
import { useMetrics } from '../../hooks/useMetrics';
import type { ViewMode } from '../../types';

interface WatchStatusChapterProps {
  viewMode: ViewMode;
}

export const WatchStatusChapter: React.FC<WatchStatusChapterProps> = ({ viewMode }) => {
  const metrics = useMetrics();

  if (metrics.isLoading) return <LoadingState message="Loading metrics..." />;
  if (metrics.error) return <div className="p-6 text-red-400">Error: {metrics.error}</div>;
  if (metrics.isEmpty) return <div className="p-6 text-gray-400">No data. Select projects and date range.</div>;

  const hasActiveIncident = (metrics.headline?.activeIncidentCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">Watch Status</h2>
          <p className="text-sm text-gray-400 mt-1">
            Operational state at a glance. Red means act. Yellow means watch.
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.kpis.watch.map((kpi, index) => (
          <KPICard key={index} data={kpi} />
        ))}
      </div>

      {/* Active Incident Flag */}
      {hasActiveIncident && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-medium text-red-400">Active Incident</span>
            <span className="text-gray-400">
              {metrics.headline!.activeIncidentCount} active &middot; oldest {metrics.headline!.oldestIncidentAge.toFixed(1)} working hours
            </span>
            <a href="#incidents" className="text-kpi-blue hover:underline ml-auto">
              View Incidents →
            </a>
          </div>
        </div>
      )}

      {/* Stalled Ticket Alert */}
      {metrics.stalledTickets.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="font-medium text-yellow-400">Stalled Tickets</span>
            <span className="text-gray-400">
              {metrics.stalledTickets.length} ticket{metrics.stalledTickets.length !== 1 ? 's' : ''} with no activity &gt; 48 working hours
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {metrics.stalledTickets.slice(0, 5).map((t) => (
              <span key={t.issueKey} className="text-xs font-mono bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded">
                {t.issueKey} ({t.stalledDurationHours.toFixed(0)}h)
              </span>
            ))}
            {metrics.stalledTickets.length > 5 && (
              <span className="text-xs text-gray-500">
                +{metrics.stalledTickets.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Needs Attention — open tickets by priority */}
      {viewMode === 'analyst' && (() => {
        const openTickets = (metrics.projectIssues ?? []).filter(
          (i) => !i.fields.resolutiondate,
        );
        const byPriority = new Map<string, number>();
        for (const t of openTickets) {
          const p = t.fields.priority?.name ?? 'None';
          byPriority.set(p, (byPriority.get(p) ?? 0) + 1);
        }
        const priorityOrder = ['Highest', 'High', 'Medium', 'Low', 'Lowest', 'None'];
        const sorted = [...byPriority.entries()].sort(
          (a, b) => priorityOrder.indexOf(a[0]) - priorityOrder.indexOf(b[0]),
        );
        const top10 = openTickets
          .sort((a, b) => {
            const pa = priorityOrder.indexOf(a.fields.priority?.name ?? 'None');
            const pb = priorityOrder.indexOf(b.fields.priority?.name ?? 'None');
            return pa - pb;
          })
          .slice(0, 10);
        const stalledCount = metrics.stalledTickets.length;

        return (
          <div className="bg-soc-card border border-soc-border rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-100 mb-4">Needs Attention</h3>

            {stalledCount > 0 && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                <span className="text-sm font-medium text-yellow-400">
                  {stalledCount} stalled ticket{stalledCount !== 1 ? 's' : ''}
                </span>
                <span className="text-sm text-gray-400 ml-2">
                  — no activity in 48+ working hours
                </span>
              </div>
            )}

            {sorted.length > 0 ? (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Open by Priority</h4>
                <div className="flex flex-wrap gap-3">
                  {sorted.map(([priority, count]) => (
                    <div key={priority} className="flex items-center gap-2 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        priority === 'Highest' ? 'text-red-400 bg-red-500/10'
                          : priority === 'High' ? 'text-orange-400 bg-orange-500/10'
                            : priority === 'Medium' ? 'text-yellow-400 bg-yellow-500/10'
                              : priority === 'Low' ? 'text-green-400 bg-green-500/10'
                                : 'text-gray-400 bg-gray-500/10'
                      }`}>
                        {priority}
                      </span>
                      <span className="text-gray-300">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mb-4">No open tickets in queue.</p>
            )}

            {top10.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Top 10 by Priority</h4>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-1 px-2 text-xs font-medium text-gray-500">Key</th>
                      <th className="text-left py-1 px-2 text-xs font-medium text-gray-500">Summary</th>
                      <th className="text-left py-1 px-2 text-xs font-medium text-gray-500">Priority</th>
                      <th className="text-left py-1 px-2 text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10.map((t) => (
                      <tr key={t.id} className="border-b border-gray-800">
                        <td className="py-1 px-2 text-sm font-mono text-gray-300">{t.key}</td>
                        <td className="py-1 px-2 text-sm text-gray-300 truncate max-w-xs">{t.fields.summary}</td>
                        <td className="py-1 px-2 text-sm text-gray-400">{t.fields.priority?.name ?? 'None'}</td>
                        <td className="py-1 px-2 text-sm text-gray-400">{t.fields.status.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {viewMode === 'executive' && (
        <div className="bg-soc-card border border-soc-border rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-100 mb-4">Assessment</h3>
          {metrics.staffing && (
            <p className="text-gray-300 mb-4">
              <strong className={
                metrics.staffing.verdict === 'understaffed' ? 'text-red-400'
                  : metrics.staffing.verdict === 'healthy' ? 'text-green-400'
                    : 'text-yellow-400'
              }>
                {metrics.staffing.verdict.replace(/_/g, ' ').toUpperCase()}.
              </strong>{' '}
              {metrics.staffing.narrative}
            </p>
          )}
          {(metrics.insights ?? []).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-400">Attention Items</h4>
              {(metrics.insights ?? [])
                .filter((i) => i.severity === 'critical' || i.severity === 'warning')
                .slice(0, 6)
                .map((insight) => (
                  <div key={insight.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      insight.severity === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-gray-300">{insight.text}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
