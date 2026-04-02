import React, { useState, useEffect } from 'react';
import { ProgressBar } from './ProgressBar';
import { useSyncProgress } from '../../hooks/useJiraData';

const QUOTES = [
  'Fetching ticket fields...',
  'Analyzing status transitions...',
  'Building changelog history...',
  'Counting queue depth changes...',
  'Mapping priority distributions...',
  'Indexing label breakdowns...',
  'Calculating response times...',
  'Parsing assignee handoffs...',
  'Detecting stalled tickets...',
  'Correlating resolution patterns...',
];

const QUOTE_INTERVAL_MS = 3500;

export const SyncProgressOverlay: React.FC = () => {
  const progress = useSyncProgress();
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, QUOTE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  if (!progress) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-soc-bg/80 backdrop-blur-sm">
      <div className="w-full max-w-sm p-6 bg-soc-card border border-soc-border rounded-lg shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-kpi-blue border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-sm font-medium text-gray-200">
              Syncing {progress.project_key}
            </p>
            <p className="text-xs text-gray-500">
              Phase: {progress.phase} &middot; {progress.direction}
            </p>
          </div>
        </div>

        <ProgressBar
          value={progress.fetched}
          max={Math.max(progress.fetched * 1.2, 100)}
          label={`${progress.fetched} tickets fetched`}
          size="md"
          showPercentage={false}
        />

        <p className="text-xs text-gray-500 italic animate-pulse">
          {QUOTES[quoteIndex]}
        </p>
      </div>
    </div>
  );
};
