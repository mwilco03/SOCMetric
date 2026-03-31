import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/shell/AppShell';
import { WatchStatusChapter } from './components/chapters/WatchStatusChapter';
import { FlowChapter } from './components/chapters/FlowChapter';
import { ResponseSpeedChapter } from './components/chapters/ResponseSpeedChapter';
import { CapacityChapter } from './components/chapters/CapacityChapter';
import { PatternsChapter } from './components/chapters/PatternsChapter';
import { IncidentsChapter } from './components/chapters/IncidentsChapter';
import { ProjectionsChapter } from './components/chapters/ProjectionsChapter';
import { CompareChapter } from './components/chapters/CompareChapter';
import { ContextLedgerChapter } from './components/chapters/ContextLedgerChapter';
import { SetupWizard } from './components/discovery-ui/SetupWizard';
import { VaultUnlock } from './components/vault/VaultUnlock';
import { VaultManager } from './vault/vaultManager';
import { useDashboardStore } from './store/dashboardStore';
import { PanelProvider, SlideOutPanel } from './components/panels';

import type { VaultPayload } from './vault/vaultManager';

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

  const renderChapter = () => {
    switch (activeChapter) {
      case 'watch': return <WatchStatusChapter viewMode={viewMode} />;
      case 'ledger': return <ContextLedgerChapter />;
      case 'flow': return <FlowChapter viewMode={viewMode} />;
      case 'speed': return <ResponseSpeedChapter viewMode={viewMode} />;
      case 'capacity': return <CapacityChapter viewMode={viewMode} />;
      case 'patterns': return <PatternsChapter viewMode={viewMode} />;
      case 'incidents': return <IncidentsChapter viewMode={viewMode} />;
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
    </PanelProvider>
  );
}

function AppRouter() {
  const { appPhase, setAppPhase, setJiraConfig, setWorkSchedule } = useDashboardStore();

  useEffect(() => {
    if (VaultManager.vaultExists()) {
      setAppPhase('unlock');
    } else {
      setAppPhase('setup');
    }
  }, [setAppPhase]);

  const handleVaultUnlock = (payload: VaultPayload | null) => {
    if (!payload) return;
    setJiraConfig({
      domain: payload.credentials.domain,
      email: payload.credentials.email,
      apiToken: payload.credentials.apiToken,
    });
    if (payload.workSchedule) {
      setWorkSchedule({
        timezone: payload.workSchedule.timezone,
        shifts: payload.workSchedule.shifts.map(s => ({
          ...s,
          timezone: s.timezone || payload.workSchedule.timezone,
        })),
      });
    }
    setAppPhase('dashboard');
  };

  const handleSetupComplete = () => {
    setAppPhase('unlock');
  };

  const handleVaultReset = () => {
    queryClient.clear();
    setJiraConfig(null);
    setAppPhase('setup');
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
    case 'unlock':
      return <VaultUnlock onUnlock={handleVaultUnlock} onReset={handleVaultReset} />;
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

