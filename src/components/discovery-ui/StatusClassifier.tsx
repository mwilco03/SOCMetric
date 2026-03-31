import React, { useState, useEffect } from 'react';
import type { JiraStatus } from '../../api/types';
import { useDashboardStore } from '../../store/dashboardStore';
import { discoverStatusMappings } from '../../discovery/statusDiscovery';

interface StatusClassifierProps {
  projectKey: string;
  statuses: JiraStatus[];
  onComplete: () => void;
}

type Classification = 'queue' | 'active' | 'done';

const CLASSIFICATIONS: { value: Classification; label: string; description: string }[] = [
  { value: 'queue', label: 'Queue', description: 'Waiting to be worked' },
  { value: 'active', label: 'Active', description: 'Currently being worked' },
  { value: 'done', label: 'Done', description: 'Completed/Closed' },
];

const CONFIDENCE_BADGE: Record<string, string> = {
  high: 'text-green-400',
  medium: 'text-yellow-400',
  low: 'text-gray-500',
};

export const StatusClassifier: React.FC<StatusClassifierProps> = ({
  projectKey,
  statuses,
  onComplete,
}) => {
  const { statusMappings, setStatusMapping } = useDashboardStore();
  const [currentMappings, setCurrentMappings] = useState<Record<string, Classification>>({});

  // Auto-discover on mount
  useEffect(() => {
    const discovered = discoverStatusMappings(statuses);
    const autoMappings: Record<string, Classification> = {};
    for (const d of discovered) {
      autoMappings[d.status] = d.suggestedClassification;
      setStatusMapping(projectKey, d.status, d.suggestedClassification);
    }
    setCurrentMappings(autoMappings);
  }, [statuses, projectKey, setStatusMapping]);

  const discovered = discoverStatusMappings(statuses);
  const discoveryMap = new Map(discovered.map((d) => [d.status, d]));

  const handleClassify = (statusName: string, classification: Classification) => {
    setCurrentMappings((prev) => ({ ...prev, [statusName]: classification }));
    setStatusMapping(projectKey, statusName, classification);
  };

  const allClassified = statuses.every(
    (s) => currentMappings[s.name] || statusMappings[projectKey]?.[s.name],
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-100">Classify Statuses: {projectKey}</h3>
        <p className="text-sm text-gray-400 mt-1">
          Auto-detected from Jira categories. Review and adjust if needed.
        </p>
      </div>

      <div className="space-y-2">
        {statuses.map((status) => {
          const current = currentMappings[status.name] ||
            statusMappings[projectKey]?.[status.name] ||
            'queue';
          const discovery = discoveryMap.get(status.name);

          return (
            <div
              key={status.id}
              className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-200">{status.name}</span>
                {discovery && (
                  <span className={`text-xs ${CONFIDENCE_BADGE[discovery.confidence]}`}>
                    {discovery.confidence}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {CLASSIFICATIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleClassify(status.name, c.value)}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${
                      current === c.value
                        ? c.value === 'queue'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : c.value === 'active'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                    }`}
                    title={c.description}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onComplete}
        disabled={!allClassified}
        className="w-full py-2 bg-kpi-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {allClassified ? 'Continue' : 'Classify all statuses to continue'}
      </button>
    </div>
  );
};
