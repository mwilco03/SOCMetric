import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDashboardStore } from '../../store/dashboardStore';
import type { JiraProject, DiscoveredMapping } from '../../types';

interface SetupWizardProps {
  onComplete: () => void;
}

type Step = 'credentials' | 'projects' | 'statuses';

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const { setProjectKey, setStatusMapping } = useDashboardStore();

  const [step, setStep] = useState<Step>('credentials');
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [discoveredMappings, setDiscoveredMappings] = useState<DiscoveredMapping[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testCredentials = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await invoke('test_connection', { domain, email, apiToken });
      await invoke('set_credentials', { domain, email, apiToken });
      const projectList = await invoke<JiraProject[]>('get_projects');
      setProjects(projectList);
      setStep('projects');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const selectProjectAndDiscover = async (projectKey: string) => {
    setSelectedProject(projectKey);
    setIsLoading(true);
    setError(null);
    try {
      const discovered = await invoke<DiscoveredMapping[]>('discover_statuses', { projectKey });
      setDiscoveredMappings(discovered);
      const autoMappings: Record<string, string> = {};
      for (const d of discovered) {
        autoMappings[d.status_name] = d.classification;
      }
      setMappings(autoMappings);
      setStep('statuses');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const completeSetup = async () => {
    if (!selectedProject) return;
    setIsLoading(true);
    setError(null);
    try {
      // Store project key in SQLite settings
      await invoke('set_setting', { key: 'project_key', value: selectedProject });

      // Store status mappings in SQLite
      await invoke('bulk_set_status_mappings', {
        projectKey: selectedProject,
        mappings,
      });

      // Update local store
      setProjectKey(selectedProject);
      for (const [status, classification] of Object.entries(mappings)) {
        setStatusMapping(selectedProject, status, classification as 'queue' | 'active' | 'done');
      }

      // Trigger initial 30-day sync
      const end = new Date();
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      await invoke('sync_project', {
        projectKey: selectedProject,
        startDate: fmt(start),
        endDate: fmt(end),
      });

      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const CLASSIFICATIONS = [
    { value: 'queue', label: 'Queue', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { value: 'active', label: 'Active', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    { value: 'done', label: 'Done', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    { value: 'blocked', label: 'Blocked', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  ];

  const CONFIDENCE_BADGE: Record<string, string> = {
    high: 'text-green-400',
    medium: 'text-yellow-400',
    low: 'text-gray-500',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-soc-bg p-6">
      <div className="w-full max-w-md bg-soc-card border border-soc-border rounded-lg p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-2">SOC Dashboard Setup</h1>
        <p className="text-sm text-gray-400 mb-6">
          Connect to Jira and configure your queue.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
            {error}
          </div>
        )}

        {step === 'credentials' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Jira Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="your-domain.atlassian.net"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Token</label>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
              />
              <p className="text-xs text-gray-500 mt-1">
                Create at: id.atlassian.com/manage-profile/security/api-tokens
              </p>
            </div>
            <button
              onClick={testCredentials}
              disabled={isLoading || !domain || !email || !apiToken}
              className="w-full py-2 bg-kpi-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Connecting...' : 'Test Connection'}
            </button>
          </div>
        )}

        {step === 'projects' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Select your primary queue ({projects.length} projects found):
            </p>
            <input
              type="text"
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm"
            />
            <div className="max-h-64 overflow-y-auto space-y-2">
              {projects
                .filter((p) => {
                  if (!projectSearch) return true;
                  const q = projectSearch.toLowerCase();
                  return p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q);
                })
                .map((project) => (
                <button
                  key={project.id}
                  onClick={() => selectProjectAndDiscover(project.key)}
                  disabled={isLoading}
                  className={`w-full flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-800 text-left ${
                    selectedProject === project.key ? 'bg-gray-800 border border-kpi-blue' : 'bg-gray-800/50'
                  }`}
                >
                  <div>
                    <span className="text-sm text-gray-200">{project.name}</span>
                    <span className="text-xs text-gray-500 ml-2">({project.key})</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'statuses' && selectedProject && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-200">
                Classify statuses for {selectedProject}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Auto-detected from Jira. Review and adjust.
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {discoveredMappings.map((d) => (
                <div
                  key={d.status_name}
                  className="flex items-center justify-between p-2 bg-gray-800/50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-200">{d.status_name}</span>
                    <span className={`text-xs ${CONFIDENCE_BADGE[d.confidence] ?? 'text-gray-500'}`}>
                      {d.confidence}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {CLASSIFICATIONS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setMappings((prev) => ({ ...prev, [d.status_name]: c.value }))}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          mappings[d.status_name] === c.value
                            ? `${c.color} border`
                            : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={completeSetup}
              disabled={isLoading}
              className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="flex gap-1">
            {(['credentials', 'projects', 'statuses'] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded ${
                  step === s ||
                  (step === 'projects' && s === 'credentials') ||
                  (step === 'statuses' && (s === 'credentials' || s === 'projects'))
                    ? 'bg-kpi-blue'
                    : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
