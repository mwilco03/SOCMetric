import React from 'react';
import { X, Settings } from 'lucide-react';
import { useDashboardStore } from '../../store/dashboardStore';

interface RightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RightDrawer: React.FC<RightDrawerProps> = ({ isOpen, onClose }) => {
  const { workSchedule, selectedProjectKeys, irProjectKey, setIrProject } = useDashboardStore();

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" role="presentation" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[360px] max-w-[90vw] bg-soc-bg border-l border-soc-border z-50 shadow-2xl flex flex-col animate-slide-in" role="dialog" aria-label="Settings">
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

          {/* Projects */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Selected Projects</h3>
            <div className="space-y-1">
              {selectedProjectKeys.map((key) => (
                <div key={key} className="px-3 py-2 bg-gray-800/50 rounded text-sm text-gray-200">
                  {key}
                </div>
              ))}
            </div>
          </div>

          {/* IR Project */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">IR Project Key</h3>
            <input
              type="text"
              value={irProjectKey ?? ''}
              onChange={(e) => setIrProject(e.target.value)}
              placeholder="e.g., IR"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200"
            />
            <p className="text-xs text-gray-500 mt-1">
              Set to enable incident tracking and cross-project impact analysis.
            </p>
          </div>

          {/* Info */}
          <div className="pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              Vault-stored settings (credentials, status mappings) can be changed by resetting the vault from the unlock screen.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
