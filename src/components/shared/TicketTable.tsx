import React, { useState } from 'react';
import type { JiraIssue } from '../../api/types';
import { formatDate } from '../../utils/formatting';

interface TicketTableProps {
  tickets: JiraIssue[];
  maxRows?: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  'Highest': 'text-red-400 bg-red-500/10',
  'High': 'text-orange-400 bg-orange-500/10',
  'Medium': 'text-yellow-400 bg-yellow-500/10',
  'Low': 'text-green-400 bg-green-500/10',
  'Lowest': 'text-gray-400 bg-gray-500/10',
};

export const TicketTable: React.FC<TicketTableProps> = ({
  tickets,
  maxRows = 10,
}) => {
  const [visibleCount, setVisibleCount] = useState(maxRows);
  const displayTickets = tickets.slice(0, visibleCount);
  const hasMore = visibleCount < tickets.length;

  if (tickets.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No tickets to display
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Key</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Summary</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Status</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Priority</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Created</th>
          </tr>
        </thead>
        <tbody>
          {displayTickets.map((ticket) => (
            <tr
              key={ticket.id}
              className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
            >
              <td className="py-2 px-3">
                <span className="text-sm font-mono text-gray-300">
                  {ticket.key}
                </span>
              </td>
              <td className="py-2 px-3">
                <span className="text-sm text-gray-300 truncate max-w-xs block">
                  {ticket.fields.summary}
                </span>
              </td>
              <td className="py-2 px-3">
                <span className="text-sm text-gray-400">
                  {ticket.fields.status.name}
                </span>
              </td>
              <td className="py-2 px-3">
                {ticket.fields.priority && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      PRIORITY_COLORS[ticket.fields.priority.name] ||
                      'text-gray-400 bg-gray-500/10'
                    }`}
                  >
                    {ticket.fields.priority.name}
                  </span>
                )}
              </td>
              <td className="py-2 px-3">
                <span className="text-sm text-gray-500">
                  {formatDate(ticket.fields.created)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {hasMore && (
        <button
          onClick={() => setVisibleCount((prev) => Math.min(prev + maxRows, tickets.length))}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Show {Math.min(maxRows, tickets.length - visibleCount)} more ({tickets.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
};

