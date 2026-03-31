import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { usePanel } from './PanelContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatDate } from '../../utils/formatting';

export const BottomSheet: React.FC = () => {
  const { bottomSheet, closeTicketDetail } = usePanel();
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, bottomSheet.isOpen);

  useEffect(() => {
    if (!bottomSheet.isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTicketDetail();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bottomSheet.isOpen, closeTicketDetail]);

  if (!bottomSheet.isOpen || !bottomSheet.issue) return null;

  const issue = bottomSheet.issue;
  const histories = issue.changelog?.histories || [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        role="presentation"
        onClick={closeTicketDetail}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 max-h-[60vh] bg-soc-bg border-t border-soc-border z-50 shadow-2xl flex flex-col rounded-t-xl"
        role="dialog"
        aria-label={`Ticket ${issue.key}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-soc-border">
          <div className="flex items-center gap-3">
            <span className="font-mono text-kpi-blue font-semibold">{issue.key}</span>
            <span className="text-sm text-gray-300 truncate max-w-md">{issue.fields.summary}</span>
          </div>
          <button
            onClick={closeTicketDetail}
            aria-label="Close ticket detail"
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm text-gray-200">{issue.fields.status.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Priority</p>
              <p className="text-sm text-gray-200">{issue.fields.priority?.name ?? 'None'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Created</p>
              <p className="text-sm text-gray-200">{formatDate(issue.fields.created)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Resolved</p>
              <p className="text-sm text-gray-200">
                {issue.fields.resolutiondate ? formatDate(issue.fields.resolutiondate) : 'Open'}
              </p>
            </div>
          </div>

          {/* Changelog Timeline */}
          {histories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Status Timeline</h3>
              <div className="space-y-2">
                {histories
                  .filter((h) => h.items.some((i) => i.field === 'status'))
                  .slice(-10)
                  .map((h) => {
                    const statusItem = h.items.find((i) => i.field === 'status');
                    if (!statusItem) return null;
                    return (
                      <div key={h.id} className="flex items-center gap-3 text-sm">
                        <span className="text-xs text-gray-500 w-32 shrink-0">
                          {formatDate(h.created)}
                        </span>
                        <span className="text-gray-500">{statusItem.fromString}</span>
                        <span className="text-gray-600">&rarr;</span>
                        <span className="text-gray-200">{statusItem.toString}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
