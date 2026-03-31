import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { usePanel } from './PanelContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export const SlideOutPanel: React.FC = () => {
  const { slideOut, closeSlideOut } = usePanel();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, slideOut.isOpen);

  useEffect(() => {
    if (!slideOut.isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSlideOut();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [slideOut.isOpen, closeSlideOut]);

  if (!slideOut.isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        role="presentation"
        onClick={closeSlideOut}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-[560px] max-w-[90vw] bg-soc-bg border-l border-soc-border z-50 shadow-2xl flex flex-col animate-slide-in"
        role="dialog"
        aria-label={slideOut.title}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-soc-border">
          <h2 className="text-lg font-semibold text-gray-100">{slideOut.title}</h2>
          <button
            onClick={closeSlideOut}
            aria-label="Close panel"
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {slideOut.content}
        </div>
      </div>
    </>
  );
};
