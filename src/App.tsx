import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/shell/AppShell';
import { WatchStatusChapter } from './components/chapters/WatchStatusChapter';
import { FlowChapter } from './components/chapters/FlowChapter';
import { ResponseSpeedChapter } from './components/chapters/ResponseSpeedChapter';
import { CapacityChapter } from './components/chapters/CapacityChapter';
import { PatternsChapter } from './components/chapters/PatternsChapter';

import { ProjectionsChapter } from './components/chapters/ProjectionsChapter';
import { CompareChapter } from './components/chapters/CompareChapter';
import { ContextLedgerChapter } from './components/chapters/ContextLedgerChapter';
import { CalendarChapter } from './components/chapters/CalendarChapter';
import { SetupWizard } from './components/discovery-ui/SetupWizard';
import { useDashboardStore } from './store/dashboardStore';
import { PanelProvider, SlideOutPanel } from './components/panels';
import { SyncProgressOverlay } from './components/shared/SyncProgressOverlay';
import { useCredentials } from './hooks/useJiraData';
import { useIdleSync } from './hooks/useIdleSync';
import { invoke } from '@tauri-apps/api/core';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function DashboardContent() {
  const { viewMode, activeChapter, setViewMode, setActiveChapter } = useDashboardStore();
  useIdleSync();

  const renderChapter = () => {
    switch (activeChapter) {
      case 'calendar': return <CalendarChapter />;
      case 'watch': return <WatchStatusChapter viewMode={viewMode} />;
      case 'ledger': return <ContextLedgerChapter />;
      case 'flow': return <FlowChapter viewMode={viewMode} />;
      case 'speed': return <ResponseSpeedChapter viewMode={viewMode} />;
      case 'capacity': return <CapacityChapter viewMode={viewMode} />;
      case 'patterns': return <PatternsChapter viewMode={viewMode} />;

      case 'projections': return <ProjectionsChapter viewMode={viewMode} />;
      case 'compare': return <CompareChapter viewMode={viewMode} />;
      default: return <WatchStatusChapter viewMode={viewMode} />;
    }
  };

  return (
    <PanelProvider>
      <AppShell
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeChapter={activeChapter}
        onChapterChange={setActiveChapter}
      >
        {renderChapter()}
      </AppShell>
      <SlideOutPanel />
      <SyncProgressOverlay />
    </PanelProvider>
  );
}

function AppRouter() {
  const { appPhase, setAppPhase, setProjectKey } = useDashboardStore();
  const { data: credential, isLoading: credLoading } = useCredentials();

  useEffect(() => {
    if (credLoading) return;

    if (credential) {
      // Has credentials — check if project is configured
      invoke<string | null>('get_setting', { key: 'project_key' }).then((pk) => {
        if (pk) {
          setProjectKey(pk);
          setAppPhase('dashboard');
        } else {
          setAppPhase('setup');
        }
      }).catch(() => setAppPhase('setup'));
    } else {
      setAppPhase('setup');
    }
  }, [credential, credLoading, setAppPhase, setProjectKey]);

  const handleSetupComplete = () => {
    setAppPhase('dashboard');
  };

  switch (appPhase) {
    case 'loading':
      return (
        <div className="min-h-screen flex items-center justify-center bg-soc-bg">
          <div className="text-gray-400">Loading...</div>
        </div>
      );
    case 'setup':
      return <SetupWizard onComplete={handleSetupComplete} />;
    case 'dashboard':
      return <DashboardContent />;
    default:
      return null;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}

export default App;
