import React from 'react';
import { LoadingState } from '../shared/LoadingState';
import { useMetrics } from '../../hooks/useMetrics';
import type { ViewMode } from '../../types';

interface IncidentsChapterProps {
  viewMode: ViewMode;
}

export const IncidentsChapter: React.FC<IncidentsChapterProps> = ({ viewMode }) => {
  const metrics = useMetrics();

  if (metrics.isLoading) return <LoadingState message="Loading metrics..." />;
  if (metrics.error) return <div className="p-6 text-red-400">Error: {metrics.error}</div>;
  if (metrics.isEmpty) return <div className="p-6 text-gray-400">No data. Select projects and date range.</div>;

  const irIssues = metrics.irIssues ?? [];
  const activeIncidents = irIssues.filter((i) => !i.fields.resolutiondate);
  const hasActiveIncident = activeIncidents.length > 0;
  const impact = metrics.incidentImpact;

  if (irIssues.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">Incidents</h2>
          <p className="text-sm text-gray-400 mt-1">
            Incident Response project metrics and queue impact.
          </p>
        </div>
        <div className="bg-soc-card border border-soc-border rounded-lg p-6">
          <p className="text-sm text-gray-400">
            No IR project key is configured, or no incident issues were found.
            Set the IR project key in the dashboard settings to enable incident tracking.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">Incidents</h2>
        <p className="text-sm text-gray-400 mt-1">
          Incident Response project metrics and queue impact.
        </p>
      </div>

      {/* Active Incident Alert */}
      {hasActiveIncident && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-medium text-red-400">
              {activeIncidents.length} Active Incident{activeIncidents.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Incident Cost Summary */}
      {impact && impact.costs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-soc-card border border-soc-border rounded-lg p-4">
            <p className="text-xs text-gray-500">Incident Windows</p>
            <p className="text-2xl font-bold text-gray-100 mt-1">{impact.windows.length}</p>
            <p className="text-sm text-gray-400 mt-1">
              {impact.windows.reduce((s, w) => s + w.durationDays, 0)} total days
            </p>
          </div>
          <div className="bg-soc-card border border-soc-border rounded-lg p-4">
            <p className="text-xs text-gray-500">Estimated Cost</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{impact.totalCostHours.toFixed(0)}h</p>
            <p className="text-sm text-gray-400 mt-1">Queue displacement hours</p>
          </div>
          <div className="bg-soc-card border border-soc-border rounded-lg p-4">
            <p className="text-xs text-gray-500">TTFT Degradation</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">
              {impact.worstIncident
                ? `+${impact.worstIncident.ttftDegradationPct.toFixed(0)}%`
                : '—'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {impact.worstIncident
                ? `During ${impact.worstIncident.incidentKey}`
                : 'No degradation detected'}
            </p>
          </div>
        </div>
      )}

      {/* Per-Incident Cost Table */}
      {impact && impact.costs.length > 0 && (
        <div className="bg-soc-card border border-soc-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Queue Impact by Incident</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Incident</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Close Rate Drop</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">TTFT Impact</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Tickets Displaced</th>
                </tr>
              </thead>
              <tbody>
                {impact.costs.map((c) => (
                  <tr key={c.incidentKey} className="border-b border-gray-800">
                    <td className="py-2 px-3 text-sm font-mono text-kpi-blue">{c.incidentKey}</td>
                    <td className="py-2 px-3 text-sm text-right text-gray-400">
                      {c.closeRateDropPct > 0 ? `-${c.closeRateDropPct.toFixed(0)}%` : '—'}
                    </td>
                    <td className="py-2 px-3 text-sm text-right text-gray-400">
                      {c.ttftDegradationPct > 0 ? `+${c.ttftDegradationPct.toFixed(0)}%` : '—'}
                    </td>
                    <td className="py-2 px-3 text-sm text-right text-red-400">
                      {c.estimatedTicketsDisplaced}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Incidents */}
        <div className="bg-soc-card border border-soc-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">
            Active Incidents ({activeIncidents.length})
          </h3>
          <div className="space-y-3">
            {activeIncidents.length === 0 ? (
              <p className="text-sm text-gray-500">No active incidents.</p>
            ) : (
              activeIncidents.map((incident) => (
                <div
                  key={incident.key}
                  className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-red-400">{incident.key}</span>
                    {incident.fields.priority && (
                      <span className="text-xs px-2 py-0.5 bg-red-500 text-white rounded">
                        {incident.fields.priority.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mt-1">{incident.fields.summary}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>Status: {incident.fields.status.name}</span>
                    <span>Created: {new Date(incident.fields.created).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* All IR Issues */}
        <div className="bg-soc-card border border-soc-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            All IR Issues ({irIssues.length})
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {irIssues.map((issue) => (
              <div
                key={issue.key}
                className="flex items-center justify-between p-2 bg-gray-800/50 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{issue.key}</span>
                  <span className="text-sm text-gray-300 truncate max-w-xs">
                    {issue.fields.summary}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  issue.fields.resolutiondate
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {issue.fields.status.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {viewMode === 'lead' && impact && impact.windows.length > 0 && (() => {
        const windows = impact.windows;
        const allDates = windows.flatMap((w) => [new Date(w.startDate).getTime(), new Date(w.endDate).getTime()]);
        const minTime = Math.min(...allDates);
        const maxTime = Math.max(...allDates);
        const range = maxTime - minTime || 1;

        return (
          <div className="bg-soc-card border border-soc-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Incident Timeline</h3>
            <div className="space-y-2">
              {windows.map((w) => {
                const startPct = ((new Date(w.startDate).getTime() - minTime) / range) * 100;
                const widthPct = Math.max(2, ((new Date(w.endDate).getTime() - new Date(w.startDate).getTime()) / range) * 100);
                return (
                  <div key={w.incidentKey} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-400 w-24 shrink-0">{w.incidentKey}</span>
                    <div className="flex-1 h-6 bg-gray-800/50 rounded relative">
                      <div
                        className="absolute h-full bg-red-500/40 border border-red-500/60 rounded"
                        style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                        title={`${w.startDate} to ${w.endDate} (${w.durationDays}d)`}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right shrink-0">{w.durationDays}d</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{new Date(minTime).toLocaleDateString()}</span>
              <span>{new Date(maxTime).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
