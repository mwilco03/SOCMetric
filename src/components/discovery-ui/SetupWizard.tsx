import React, { useState } from 'react';
import { createJiraClient } from '../../api/jiraClient';
import { encryptVault } from '../../vault/encryption';
import { VAULT_KEY } from '../../vault/vaultManager';
import { MIN_PASSPHRASE_LENGTH } from '../../constants';
import type { JiraConfig, JiraProject } from '../../api/types';

interface SetupWizardProps {
  onComplete: () => void;
}

type Step = 'credentials' | 'projects' | 'schedule' | 'passphrase';

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>('credentials');
  const [config, setConfig] = useState<JiraConfig>({
    domain: '',
    email: '',
    apiToken: '',
  });
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testCredentials = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const client = createJiraClient(config);
      await client.testConnection();
      const projects = await client.getProjects();
      setProjects(projects);
      setStep('projects');
    } catch (e) {
      let msg = 'Connection failed';
      if (e instanceof Error) {
        if (e.message.includes('Invalid Jira domain')) msg = e.message;
        else if (e.message.includes('Invalid Jira credentials')) msg = 'Invalid email or API token. Check your credentials.';
        else if (e.message.includes('Insufficient permissions')) msg = 'API token lacks permissions. Ensure it has read access.';
        else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) msg = 'Network error — check your internet connection and domain.';
        else msg = e.message;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const saveVault = async () => {
    setIsLoading(true);
    try {
      const vault = {
        credentials: config,
        projects: {
          selectedKeys: selectedProjects,
        },
        statusMappings: {},
        ttftAnchors: {},
        workSchedule: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          shifts: [
            {
              name: 'Day',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              startHour: 9,
              endHour: 17,
              workDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
              baseHeadcount: 1,
            },
          ],
        },
        preferences: {
          viewMode: selectedProjects.length === 1 ? 'analyst' : 'lead',
          defaultDateRange: 14,
        },
      };

      const encrypted = await encryptVault(vault, passphrase);
      localStorage.setItem(VAULT_KEY, JSON.stringify(encrypted));
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save vault');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-soc-bg p-6">
      <div className="w-full max-w-md bg-soc-card border border-soc-border rounded-lg p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-2">SOC Dashboard Setup</h1>
        <p className="text-sm text-gray-400 mb-6">
          Configure your Jira connection and security settings.
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
                value={config.domain}
                onChange={(e) => setConfig({ ...config, domain: e.target.value })}
                placeholder="your-domain.atlassian.net"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={config.email}
                onChange={(e) => setConfig({ ...config, email: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Token</label>
              <input
                type="password"
                value={config.apiToken}
                onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
              />
              <p className="text-xs text-gray-500 mt-1">
                Create at: id.atlassian.com/manage-profile/security/api-tokens
              </p>
            </div>
            <button
              onClick={testCredentials}
              disabled={isLoading || !config.domain || !config.email || !config.apiToken}
              className="w-full py-2 bg-kpi-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Connecting...' : 'Test Connection'}
            </button>
          </div>
        )}

        {step === 'projects' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Select projects to analyze ({projects.length} found):
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
                <label
                  key={project.id}
                  className="flex items-center gap-3 p-2 bg-gray-800/50 rounded cursor-pointer hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjects.includes(project.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProjects([...selectedProjects, project.key]);
                      } else {
                        setSelectedProjects(selectedProjects.filter((k) => k !== project.key));
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-600"
                  />
                  <div>
                    <span className="text-sm text-gray-200">{project.name}</span>
                    <span className="text-xs text-gray-500 ml-2">({project.key})</span>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={() => setStep('passphrase')}
              disabled={selectedProjects.length === 0}
              className="w-full py-2 bg-kpi-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'passphrase' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vault Passphrase</label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
              />
              <p className="text-xs text-gray-500 mt-1">
                This encrypts your credentials. Min {MIN_PASSPHRASE_LENGTH} characters. Cannot be recovered if lost.
              </p>
            </div>
            <button
              onClick={saveVault}
              disabled={isLoading || passphrase.length < MIN_PASSPHRASE_LENGTH}
              className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="flex gap-1">
            {(['credentials', 'projects', 'passphrase'] as Step[]).map((s, _i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded ${
                  step === s ||
                  (step === 'projects' && s === 'credentials') ||
                  (step === 'passphrase' && (s === 'credentials' || s === 'projects'))
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


