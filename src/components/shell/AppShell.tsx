import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2, ClipboardCopy, Check, RefreshCw } from 'lucide-react';
import { ViewModeToggle } from './ViewModeToggle';
import { ChapterNav } from './ChapterNav';
import { DateRangePicker } from '../shared/DateRangePicker';
import { DimensionFilterBar } from './DimensionFilterBar';
import { RightDrawer } from '../panels/RightDrawer';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useMetrics } from '../../hooks/useMetrics';
import { useSyncState, useSyncProject } from '../../hooks/useJiraData';
import { useDashboardStore } from '../../store/dashboardStore';
import { copySummaryToClipboard } from '../../utils/copySummary';
import { toISODate } from '../../utils/dateUtils';
import { DEFAULT_DATE_RANGE_DAYS } from '../../constants';
import type { ViewMode } from '../../types';

interface AppShellProps {
  children: React.ReactNode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeChapter: string;
  onChapterChange: (chapter: string) => void;
}

const COPY_FEEDBACK_MS = 2000;

export const AppShell: React.FC<AppShellProps> = ({
  children,
  viewMode,
  onViewModeChange,
  activeChapter,
  onChapterChange,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isNarrow } = useWindowSize();
  const metrics = useMetrics();
  const { projectKey, dateRange } = useDashboardStore();
  const { data: syncState } = useSyncState();
  const syncProject = useSyncProject();

  // Clean up copied timer on unmount
  useEffect(() => {
    return () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); };
  }, []);

  const lastSyncAt = syncState?.last_sync_at ? new Date(syncState.last_sync_at) : null;

  const formatAgo = (date: Date | null) => {
    if (!date) return null;
    const mins = Math.round((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  };

  const handleCopySummary = useCallback(async () => {
    try {
      await copySummaryToClipboard({
        projectKey,
        dateRange,
        kpis: metrics.kpis,
        stalledCount: metrics.stalledTickets.length,
        insights: metrics.insights ?? [],
      });
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // clipboard write failed
    }
  }, [projectKey, dateRange, metrics.kpis, metrics.stalledTickets, metrics.insights]);

  const handleManualSync = useCallback(() => {
    if (!projectKey || syncProject.isPending) return;
    const end = new Date();
    const start = new Date(Date.now() - DEFAULT_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000);
    syncProject.mutate({
      projectKey,
      startDate: toISODate(start),
      endDate: toISODate(end),
    });
  }, [projectKey, syncProject]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const collapsed = sidebarCollapsed || isNarrow;

  return (
    <div className="min-h-screen flex bg-soc-bg">
      {/* Left Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-72'
        } bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 shrink-0`}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          {!collapsed && (
            <div>
              <h1 className="text-lg font-semibold text-gray-100">SOC Dashboard</h1>
              <p className="text-xs text-gray-500 mt-1">Productivity Metrics</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="p-4 border-b border-gray-800">
            <ViewModeToggle mode={viewMode} onChange={onViewModeChange} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <ChapterNav
            viewMode={viewMode}
            activeChapter={activeChapter}
            onChapterClick={onChapterChange}
            collapsed={collapsed}
          />
        </div>

        {!collapsed && (
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs text-gray-500">
              <p>v2.2.0</p>
              <p className="mt-1">OS keychain secured</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <DateRangePicker />
            {(metrics.isLoading || syncProject.isPending) && (
              <div className="flex items-center gap-1.5 text-kpi-blue">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">{syncProject.isPending ? 'Syncing...' : 'Loading...'}</span>
              </div>
            )}
            {!metrics.isLoading && !syncProject.isPending && lastSyncAt && (
              <span className={`text-xs ${
                Date.now() - lastSyncAt.getTime() > 30 * 60 * 1000 ? 'text-yellow-500' : 'text-gray-500'
              }`}>
                Synced {formatAgo(lastSyncAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualSync}
              disabled={!projectKey || syncProject.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Sync data from Jira"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncProject.isPending ? 'animate-spin' : ''}`} />
              Sync
            </button>
            <button
              onClick={handleCopySummary}
              disabled={metrics.isEmpty}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Copy summary to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Summary'}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Settings
            </button>
          </div>
        </header>

        <DimensionFilterBar />

        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>

      <RightDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRefreshData={handleManualSync}
      />
    </div>
  );
};
