import React, { useState, useEffect } from 'react';
import { X, Settings, Plus, Trash2, RotateCcw, RefreshCw, Tag, Layers, AlertTriangle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardStore } from '../../store/dashboardStore';
import { useLabelConfig, useSetLabelIncluded } from '../../hooks/useLabelConfig';
import { useStatusMappingsFromDb, useSetStatusMapping } from '../../hooks/useStatusMappings';
import type { JiraProject } from '../../types';
import type { Shift } from '../../metrics/workingHours';

interface RightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

const DEFAULT_SHIFT: Shift = {
  name: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  startHour: 9,
  endHour: 17,
  workDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  baseHeadcount: 1,
};

const ALL_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const RightDrawer: React.FC<RightDrawerProps> = ({ isOpen, onClose, onRefreshData }) => {
  const {
    projectKey,
    workSchedule,
    setProjectKey,
    setWorkSchedule,
    setAppPhase,
  } = useDashboardStore();

  const queryClient = useQueryClient();
  const [availableProjects, setAvailableProjects] = useState<JiraProject[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [showChangeProject, setShowChangeProject] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetTier, setResetTier] = useState<'settings' | 'everything'>('settings');
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editingShiftIdx, setEditingShiftIdx] = useState<number | null>(null);
  const [showAddShift, setShowAddShift] = useState(false);

  const { data: labelConfigs = [] } = useLabelConfig();
  const setLabelIncluded = useSetLabelIncluded();
  const { data: dbMappings = {} } = useStatusMappingsFromDb();
  const setStatusMapping = useSetStatusMapping();

  useEffect(() => {
    if (!showChangeProject) return;
    setLoadingProjects(true);
    invoke<JiraProject[]>('get_projects')
      .then(setAvailableProjects)
      .catch(() => setAvailableProjects([]))
      .finally(() => setLoadingProjects(false));
  }, [showChangeProject]);

  if (!isOpen) return null;

  const handleReset = async () => {
    setDrawerError(null);
    try {
      await invoke('reset_app', { tier: resetTier });
      if (resetTier === 'everything') {
        setProjectKey(null);
        setAppPhase('setup');
      }
      queryClient.clear();
      setShowResetConfirm(false);
      onClose();
    } catch (e) {
      setDrawerError(`Reset failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleSwitchProject = async (key: string) => {
    setDrawerError(null);
    try {
      await invoke('set_setting', { key: 'project_key', value: key });
      setProjectKey(key);
      setShowChangeProject(false);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['openTickets'] });
      queryClient.invalidateQueries({ queryKey: ['syncState'] });
      queryClient.invalidateQueries({ queryKey: ['statusMappings'] });
      queryClient.invalidateQueries({ queryKey: ['labelConfig'] });
      queryClient.invalidateQueries({ queryKey: ['dayAnnotations'] });
    } catch (e) {
      setDrawerError(`Project switch failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const filteredProjects = availableProjects.filter((p) => {
    if (!projectSearch) return true;
    const q = projectSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q);
  });

  const addShift = (shift: Shift) => {
    setWorkSchedule({
      ...workSchedule,
      shifts: [...workSchedule.shifts, shift],
    });
    setShowAddShift(false);
    setEditingShift(null);
  };

  const removeShift = (index: number) => {
    setWorkSchedule({
      ...workSchedule,
      shifts: workSchedule.shifts.filter((_, i) => i !== index),
    });
  };

  const updateShift = (index: number, updated: Shift) => {
    const shifts = [...workSchedule.shifts];
    shifts[index] = updated;
    setWorkSchedule({ ...workSchedule, shifts });
    setEditingShift(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" role="presentation" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] max-w-[90vw] bg-soc-bg border-l border-soc-border z-50 shadow-2xl flex flex-col animate-slide-in" role="dialog" aria-label="Settings">
        <div className="flex items-center justify-between px-6 py-4 border-b border-soc-border">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-100">Settings</h2>
          </div>
          <div className="flex items-center gap-2">
            {onRefreshData && (
              <button
                onClick={onRefreshData}
                aria-label="Sync data from Jira"
                className="p-1.5 text-gray-400 hover:text-kpi-blue transition-colors"
                title="Sync data from Jira"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} aria-label="Close settings" className="p-1 text-gray-400 hover:text-gray-200">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {drawerError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{drawerError}</span>
            </div>
          )}

          {/* Active Project */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-300">Active Queue</h3>
              <button
                onClick={() => setShowChangeProject(!showChangeProject)}
                className="text-xs text-kpi-blue hover:text-blue-400 transition-colors"
              >
                Change
              </button>
            </div>
            <div className="px-3 py-2 bg-gray-800/50 rounded">
              <span className="text-sm text-gray-200">{projectKey ?? 'None'}</span>
            </div>

            {showChangeProject && (
              <div className="mt-3 p-3 bg-gray-800/50 rounded space-y-2">
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200"
                />
                {loadingProjects ? (
                  <p className="text-xs text-gray-500">Loading projects from Jira...</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSwitchProject(p.key)}
                        className="w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded flex justify-between"
                      >
                        <span>{p.name}</span>
                        <span className="text-xs text-gray-500">{p.key}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Shifts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-300">Shifts</h3>
              <button
                onClick={() => { setEditingShift({ ...DEFAULT_SHIFT }); setShowAddShift(true); }}
                className="flex items-center gap-1 text-xs text-kpi-blue hover:text-blue-400 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add shift
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Working hours for metrics calculations.
            </p>

            <div className="space-y-2">
              {workSchedule.shifts.map((shift, idx) => (
                <div key={idx} className="p-3 bg-gray-800/50 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-200">{shift.name || 'Unnamed'}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingShift({ ...shift }); setEditingShiftIdx(idx); setShowAddShift(false); }}
                        className="text-xs text-gray-500 hover:text-kpi-blue transition-colors"
                      >
                        edit
                      </button>
                      {workSchedule.shifts.length > 1 && (
                        <button
                          onClick={() => removeShift(idx)}
                          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                          aria-label={`Remove ${shift.name} shift`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    {shift.startHour}:00–{shift.endHour}:00 &middot; {shift.workDays.join(', ')} &middot; {shift.baseHeadcount} analyst{shift.baseHeadcount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-gray-500">{shift.timezone}</p>
                </div>
              ))}
            </div>

            {/* Shift Editor */}
            {editingShift && (
              <div className="mt-3 p-3 bg-gray-800/50 rounded space-y-3 border border-gray-700">
                <input
                  type="text"
                  value={editingShift.name}
                  onChange={(e) => setEditingShift({ ...editingShift, name: e.target.value })}
                  placeholder="Shift name (e.g., Day, Evening, Night)"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start hour</label>
                    <select
                      value={editingShift.startHour}
                      onChange={(e) => setEditingShift({ ...editingShift, startHour: Number(e.target.value) })}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{i}:00</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End hour</label>
                    <select
                      value={editingShift.endHour}
                      onChange={(e) => setEditingShift({ ...editingShift, endHour: Number(e.target.value) })}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{i}:00</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Work days</label>
                  <div className="flex gap-1">
                    {ALL_DAYS.map((day) => (
                      <button
                        key={day}
                        onClick={() => {
                          const days = editingShift.workDays.includes(day)
                            ? editingShift.workDays.filter((d) => d !== day)
                            : [...editingShift.workDays, day];
                          setEditingShift({ ...editingShift, workDays: days });
                        }}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          editingShift.workDays.includes(day)
                            ? 'bg-kpi-blue text-white'
                            : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Headcount</label>
                  <input
                    type="number"
                    min="1"
                    value={editingShift.baseHeadcount}
                    onChange={(e) => setEditingShift({ ...editingShift, baseHeadcount: Math.max(1, Number(e.target.value)) })}
                    className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!editingShift.name.trim()) return;
                      if (showAddShift) {
                        addShift(editingShift);
                      } else if (editingShiftIdx !== null) {
                        updateShift(editingShiftIdx, editingShift);
                      }
                    }}
                    disabled={!editingShift.name.trim()}
                    className="px-3 py-1.5 text-sm bg-kpi-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {showAddShift ? 'Add' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingShift(null); setEditingShiftIdx(null); setShowAddShift(false); }}
                    className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status Mappings */}
          {Object.keys(dbMappings).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-3.5 h-3.5 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-300">Status Mappings</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Classify each status for metric calculations.
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {Object.entries(dbMappings).map(([statusName, classification]) => (
                  <div
                    key={statusName}
                    className="flex items-center justify-between p-2 bg-gray-800/50 rounded"
                  >
                    <span className="text-sm text-gray-200 truncate mr-2">{statusName}</span>
                    <div className="flex gap-0.5 shrink-0">
                      {(['queue', 'active', 'done', 'blocked'] as const).map((cls) => (
                        <button
                          key={cls}
                          onClick={() => setStatusMapping.mutate({ statusName, classification: cls })}
                          className={`px-1.5 py-0.5 text-[11px] rounded transition-colors ${
                            classification === cls
                              ? cls === 'queue' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : cls === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : cls === 'done' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-gray-900 text-gray-600 hover:text-gray-400'
                          }`}
                        >
                          {cls[0].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Label Config */}
          {labelConfigs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-300">Label Filters</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Include/exclude labels from calendar breakdown.
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {labelConfigs.map((lc) => (
                  <label
                    key={lc.label}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-800/50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={lc.included}
                      onChange={(e) =>
                        setLabelIncluded.mutate({ label: lc.label, included: e.target.checked })
                      }
                      className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-gray-300 truncate">{lc.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <div className="pt-4 border-t border-gray-800">
            {showResetConfirm ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-300">Reset Application</h3>

                {/* Settings tier */}
                <button
                  onClick={() => setResetTier('settings')}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    resetTier === 'settings'
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : 'bg-gray-800/30 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <RotateCcw className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-sm font-medium text-yellow-400">Settings Only</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-5.5">
                    Clears status mappings, label config, annotations, and preferences.
                    Keeps tickets, sync history, and credentials.
                  </p>
                </button>

                {/* Everything tier */}
                <button
                  onClick={() => setResetTier('everything')}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    resetTier === 'everything'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-gray-800/30 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-sm font-medium text-red-400">Everything</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-5.5">
                    Deletes all data, tickets, and removes credentials from keychain.
                    Returns to setup wizard.
                  </p>
                </button>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleReset}
                    className={`px-4 py-1.5 text-sm text-white rounded transition-colors ${
                      resetTier === 'everything'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-yellow-600 hover:bg-yellow-700'
                    }`}
                  >
                    Reset {resetTier === 'everything' ? 'Everything' : 'Settings'}
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
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
                Reset app
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
