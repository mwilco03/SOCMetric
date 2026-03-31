import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { useDashboardStore } from '../../store/dashboardStore';
import { parseCSV } from '../../ledger/csvParser';
import { calculateEffectiveHeadcount } from '../../ledger/effectiveHeadcount';
import { AreaChart } from '../charts/AreaChart';
import type { LedgerEvent } from '../../store/dashboardStore';
import type { CSVParseResult } from '../../ledger/csvParser';

const EVENT_TYPES = [
  { id: 'absence', label: 'Analyst Absence', dotClass: 'bg-red-500' },
  { id: 'new_hire', label: 'New Hire', dotClass: 'bg-green-500' },
  { id: 'system_downtime', label: 'System Downtime', dotClass: 'bg-orange-500' },
  { id: 'rule_deployment', label: 'Rule Deployment', dotClass: 'bg-yellow-500' },
  { id: 'holiday', label: 'Holiday', dotClass: 'bg-blue-500' },
  { id: 'incident', label: 'Incident', dotClass: 'bg-gray-500' },
  { id: 'audit', label: 'Audit Period', dotClass: 'bg-purple-500' },
];

export const ContextLedgerChapter: React.FC = () => {
  const { ledgerEvents, addLedgerEvent, removeLedgerEvent, workSchedule, dateRange } = useDashboardStore();
  const [showForm, setShowForm] = useState(false);
  const [csvResult, setCsvResult] = useState<CSVParseResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<LedgerEvent>>({
    type: 'absence',
    scope: 'all',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.startDate && formData.endDate && formData.description) {
      addLedgerEvent({
        id: crypto.randomUUID(),
        type: formData.type as LedgerEvent['type'],
        startDate: formData.startDate,
        endDate: formData.endDate,
        description: formData.description,
        scope: formData.scope as LedgerEvent['scope'],
        shiftName: formData.shiftName,
      });
      setShowForm(false);
      setFormData({ type: 'absence', scope: 'all' });
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const result = parseCSV(content);
      setCsvResult(result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const importCSVEvents = () => {
    if (!csvResult) return;
    for (const event of csvResult.events) {
      addLedgerEvent(event);
    }
    setCsvResult(null);
  };

  // Effective headcount chart data
  const headcountPoints = calculateEffectiveHeadcount(workSchedule, ledgerEvents, dateRange);
  const headcountChartData = [...new Set(headcountPoints.map((p) => p.date))].map((date) => {
    const dayPoints = headcountPoints.filter((p) => p.date === date);
    const totalEffective = dayPoints.reduce((s, p) => s + p.effective, 0);
    const totalBase = dayPoints.reduce((s, p) => s + p.baseHeadcount, 0);
    return { date, effective: totalEffective, baseline: totalBase };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">Context Ledger</h2>
          <p className="text-sm text-gray-400 mt-1">
            Log events that affect team capacity and metrics interpretation.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="hidden"
          />
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-kpi-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            + Add Event
          </button>
        </div>
      </div>

      {/* CSV Import Preview */}
      {csvResult && (
        <div className="bg-soc-card border border-soc-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-300">CSV Import Preview</h3>
          <p className="text-sm text-gray-400">
            {csvResult.events.length} events parsed
            {csvResult.errors.length > 0 && `, ${csvResult.errors.length} errors`}
            {csvResult.warnings.length > 0 && `, ${csvResult.warnings.length} warnings`}
          </p>

          {csvResult.errors.length > 0 && (
            <div className="space-y-1">
              {csvResult.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-400">Line {err.line}: {err.message}</p>
              ))}
            </div>
          )}
          {csvResult.warnings.length > 0 && (
            <div className="space-y-1">
              {csvResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-400">Line {w.line}: {w.message}</p>
              ))}
            </div>
          )}

          {csvResult.events.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={importCSVEvents}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Import {csvResult.events.length} events
              </button>
              <button
                onClick={() => setCsvResult(null)}
                className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Event Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-soc-card border border-soc-border rounded-lg p-4 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Event Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as LedgerEvent['type'] })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Scope</label>
              <select
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value as LedgerEvent['scope'] })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
              >
                <option value="all">All Shifts</option>
                <option value="shift">Specific Shift</option>
                <option value="analyst">Specific Analyst</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.startDate || ''}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={formData.endDate || ''}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Analyst on sick leave"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Save Event
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Effective Headcount Timeline */}
      {headcountChartData.length > 0 && (
        <AreaChart
          title="Effective Headcount"
          headline={`Baseline vs adjusted headcount over ${headcountChartData.length} days`}
          data={headcountChartData}
          areas={[
            { key: 'baseline', name: 'Baseline', color: '#6b7280' },
            { key: 'effective', name: 'Effective', color: '#3b82f6' },
          ]}
          stacked={false}
          height={200}
        />
      )}

      {/* Events List */}
      <div className="bg-soc-card border border-soc-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-4">
          Events ({ledgerEvents.length})
        </h3>

        {ledgerEvents.length === 0 ? (
          <p className="text-sm text-gray-500">No events logged yet. Add manually or import CSV.</p>
        ) : (
          <div className="space-y-2">
            {ledgerEvents.map((event) => {
              const typeInfo = EVENT_TYPES.find((t) => t.id === event.type);
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${typeInfo?.dotClass || 'bg-gray-500'}`} />
                    <div>
                      <p className="text-sm text-gray-200">{event.description}</p>
                      <p className="text-xs text-gray-500">
                        {event.startDate} to {event.endDate} &middot; {event.scope}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeLedgerEvent(event.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
