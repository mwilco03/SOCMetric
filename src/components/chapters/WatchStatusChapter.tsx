import React from 'react';
import { KPICard } from '../kpi/KPICard';
import { LoadingState } from '../shared/LoadingState';
import { useMetrics } from '../../hooks/useMetrics';
import type { ViewMode } from '../../api/types';

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

      {/* Content based on view mode */}
      {viewMode === 'analyst' && (
        <div className="bg-soc-card border border-soc-border rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-100 mb-4">Your Queue</h3>
          <p className="text-gray-400">Assigned tickets and priorities would appear here.</p>
        </div>
      )}

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
