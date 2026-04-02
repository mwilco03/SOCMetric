import React, { useState, useEffect, useRef } from 'react';

const QUICK_TAGS = [
  'Rule Deployment',
  'Campaign / Exercise',
  'Known Noise',
  'Vendor Outage',
  'Holiday',
  'Staffing Change',
];

interface AnnotationMenuProps {
  x: number;
  y: number;
  date: string;
  existing?: string;
  onSave: (date: string, annotation: string) => void;
  onDelete: (date: string) => void;
  onClose: () => void;
}

export const AnnotationMenu: React.FC<AnnotationMenuProps> = ({
  x,
  y,
  date,
  existing,
  onSave,
  onDelete,
  onClose,
}) => {
  const [custom, setCustom] = useState(existing ?? '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[60] bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 w-64"
      style={{ left: Math.min(x, window.innerWidth - 280), top: Math.min(y, window.innerHeight - 320) }}
    >
      <p className="text-xs text-gray-400 mb-2">Annotate {date}</p>

      {/* Quick tags */}
      <div className="flex flex-wrap gap-1 mb-2">
        {QUICK_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => { onSave(date, tag); onClose(); }}
            className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="flex gap-1">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Custom note..."
          maxLength={200}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && custom.trim()) {
              onSave(date, custom.trim());
              onClose();
            }
          }}
          autoFocus
        />
        <button
          onClick={() => { if (custom.trim()) { onSave(date, custom.trim()); onClose(); } }}
          disabled={!custom.trim()}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          Save
        </button>
      </div>

      {/* Remove existing */}
      {existing && (
        <button
          onClick={() => { onDelete(date); onClose(); }}
          className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Remove annotation
        </button>
      )}
    </div>
  );
};
