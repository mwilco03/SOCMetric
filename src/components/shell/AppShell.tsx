import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ViewModeToggle } from './ViewModeToggle';
import { ChapterNav } from './ChapterNav';
import { DateRangePicker } from '../shared/DateRangePicker';
import { ExportButton } from '../shared/ExportButton';
import { DimensionFilterBar } from './DimensionFilterBar';
import { RightDrawer } from '../panels/RightDrawer';
import { useWindowSize } from '../../hooks/useWindowSize';
import type { ViewMode } from '../../api/types';

interface AppShellProps {
  children: React.ReactNode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeChapter: string;
  onChapterChange: (chapter: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  viewMode,
  onViewModeChange,
  activeChapter,
  onChapterChange,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { isNarrow } = useWindowSize();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auto-collapse on narrow windows
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
              <p>v1.1.0</p>
              <p className="mt-1">Client-side encrypted</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
          <DateRangePicker />
          <div className="flex items-center gap-3">
            <ExportButton
              data={[]}
              filename="soc-metrics.csv"
              label="Export"
            />
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

      <RightDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};
