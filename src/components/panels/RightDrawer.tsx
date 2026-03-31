import React, { useState, useEffect } from 'react';
import { X, Settings, Plus, Trash2, RotateCcw } from 'lucide-react';
import { useDashboardStore } from '../../store/dashboardStore';
import { createJiraClient } from '../../api/jiraClient';
import { VaultManager } from '../../vault/vaultManager';
import type { JiraProject } from '../../api/types';

interface RightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RightDrawer: React.FC<RightDrawerProps> = ({ isOpen, onClose }) => {
  const {
    jiraConfig,
    workSchedule,
    selectedProjectKeys,
    irProjectKey,
    setIrProject,
    selectProject,
    deselectProject,
    setAppPhase,
    setJiraConfig,
  } = useDashboardStore();

  const [availableProjects, setAvailableProjects] = useState<JiraProject[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [showAddProject, setShowAddProject] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Fetch available projects when "Add Project" is clicked
  useEffect(() => {
    if (!showAddProject || !jiraConfig) return;
    setLoadingProjects(true);
    const client = createJiraClient(jiraConfig);
    client.getProjects()
      .then(setAvailableProjects)
      .catch(() => setAvailableProjects([]))
      .finally(() => setLoadingProjects(false));
  }, [showAddProject, jiraConfig]);

  if (!isOpen) return null;

  const handleReset = () => {
    VaultManager.clearVault();
    setJiraConfig(null);
    setAppPhase('setup');
    onClose();
  };

  const unselectedProjects = availableProjects.filter(
    (p) => !selectedProjectKeys.includes(p.key),
  );

  const filteredProjects = unselectedProjects.filter((p) => {
    if (!projectSearch) return true;
    const q = projectSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" role="presentation" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[400px] max-w-[90vw] bg-soc-bg border-l border-soc-border z-50 shadow-2xl flex flex-col animate-slide-in" role="dialog" aria-label="Settings">
        <div className="flex items-center justify-between px-6 py-4 border-b border-soc-border">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-100">Settings</h2>
          </div>
          <button onClick={onClose} aria-label="Close settings" className="p-1 text-gray-400 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Selected Projects */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">Projects ({selectedProjectKeys.length})</h3>
              <button
                onClick={() => setShowAddProject(!showAddProject)}
                className="flex items-center gap-1 text-xs text-kpi-blue hover:text-blue-400 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>

            <div className="space-y-1">
              {selectedProjectKeys.map((key) => (
                <div key={key} className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded">
                  <span className="text-sm text-gray-200">{key}</span>
                  <button
                    onClick={() => deselectProject(key)}
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                    aria-label={`Remove ${key}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {selectedProjectKeys.length === 0 && (
                <p className="text-xs text-gray-500 py-2">No projects selected</p>
              )}
            </div>

            {/* Add Project Panel */}
            {showAddProject && (
              <div className="mt-3 p-3 bg-gray-800/50 rounded space-y-2">
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200"
                />
                {loadingProjects ? (
                  <p className="text-xs text-gray-500">Loading projects...</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          selectProject(p.key);
                          setProjectSearch('');
                        }}
                        className="w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded flex justify-between"
                      >
                        <span>{p.name}</span>
                        <span className="text-xs text-gray-500">{p.key}</span>
                      </button>
                    ))}
                    {filteredProjects.length === 0 && !loadingProjects && (
                      <p className="text-xs text-gray-500 py-1">
                        {unselectedProjects.length === 0 ? 'All projects selected' : 'No matches'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* IR Project */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">IR Project</h3>
            <select
              value={irProjectKey ?? ''}
              onChange={(e) => setIrProject(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200"
            >
              <option value="">None — no incident tracking</option>
              {selectedProjectKeys.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Which project contains incident response tickets.
            </p>
          </div>

          {/* Work Schedule */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Work Schedule</h3>
            <div className="space-y-2">
              <div className="p-3 bg-gray-800/50 rounded">
                <p className="text-xs text-gray-500">Timezone</p>
                <p className="text-sm text-gray-200">{workSchedule.timezone}</p>
              </div>
              {workSchedule.shifts.map((shift) => (
                <div key={shift.name} className="p-3 bg-gray-800/50 rounded">
                  <p className="text-xs text-gray-500">{shift.name} Shift</p>
                  <p className="text-sm text-gray-200">
                    {shift.startHour}:00 - {shift.endHour}:00 &middot;{' '}
                    {shift.workDays.join(', ')} &middot;{' '}
                    {shift.baseHeadcount} analyst{shift.baseHeadcount !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Reset */}
          <div className="pt-4 border-t border-gray-800">
            {showResetConfirm ? (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded space-y-3">
                <p className="text-sm text-red-400">
                  This will clear your encrypted vault and return to setup. You'll need to re-enter your Jira credentials.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Reset Everything
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-400 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset vault &amp; reconfigure
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
