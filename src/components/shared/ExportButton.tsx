import React from 'react';
import { Download } from 'lucide-react';

interface ExportData {
  [key: string]: string | number | boolean | null;
}

interface ExportButtonProps {
  data: ExportData[];
  filename?: string;
  label?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  data,
  filename = 'export.csv',
  label = 'Export CSV',
}) => {
  const downloadCSV = () => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((h) => {
            const value = row[h];
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <button
      onClick={downloadCSV}
      disabled={data.length === 0}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
    >
      <Download className="w-4 h-4" />
      {label}
    </button>
  );
};


