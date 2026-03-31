import React from 'react';
import {
  Eye,
  Zap,
  BarChart3,
  Activity,
  Search,
  TrendingUp,
  GitCompare,
  Calendar,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ViewMode } from '../../api/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Chapter {
  id: string;
  title: string;
  icon: React.ReactNode;
  visibleTo: ViewMode[];
}

const chapters: Chapter[] = [
  { id: 'watch', title: 'Watch Status', icon: <Eye className="w-4 h-4" />, visibleTo: ['analyst', 'lead', 'executive'] },
  { id: 'flow', title: 'Flow', icon: <Activity className="w-4 h-4" />, visibleTo: ['analyst', 'lead'] },
  { id: 'speed', title: 'Response Speed', icon: <Zap className="w-4 h-4" />, visibleTo: ['analyst', 'lead'] },
  { id: 'capacity', title: 'Capacity', icon: <BarChart3 className="w-4 h-4" />, visibleTo: ['lead', 'executive'] },
  { id: 'patterns', title: 'Patterns', icon: <Search className="w-4 h-4" />, visibleTo: ['analyst', 'lead'] },
  // Incidents chapter hidden — IR project concept removed. Re-enable when incident detection reworked.
  // { id: 'incidents', title: 'Incidents', icon: <AlertTriangle className="w-4 h-4" />, visibleTo: ['lead'] },
  { id: 'projections', title: 'Projections', icon: <TrendingUp className="w-4 h-4" />, visibleTo: ['executive'] },
  { id: 'compare', title: 'Compare', icon: <GitCompare className="w-4 h-4" />, visibleTo: ['executive'] },
];

interface ChapterNavProps {
  viewMode: ViewMode;
  activeChapter?: string;
  onChapterClick?: (chapterId: string) => void;
  collapsed?: boolean;
}

export const ChapterNav: React.FC<ChapterNavProps> = ({
  viewMode,
  activeChapter = 'watch',
  onChapterClick,
  collapsed = false,
}) => {
  const visibleChapters = chapters.filter((c) => c.visibleTo.includes(viewMode));

  const navButton = (id: string, icon: React.ReactNode, title: string) => (
    <button
      key={id}
      onClick={() => onChapterClick?.(id)}
      title={collapsed ? title : undefined}
      aria-current={activeChapter === id ? 'page' : undefined}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
        collapsed && 'justify-center px-2',
        activeChapter === id
          ? 'text-kpi-blue bg-blue-500/10'
          : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800',
      )}
    >
      {icon}
      {!collapsed && title}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Manager Section */}
      <div>
        {!collapsed && (
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3">
            Manager
          </span>
        )}
        <nav className="mt-2 space-y-1">
          {navButton('ledger', <Calendar className="w-4 h-4" />, 'Context Ledger')}
        </nav>
      </div>

      {/* Chapters Section */}
      <div>
        {!collapsed && (
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3">
            Chapters
          </span>
        )}
        <nav className="mt-2 space-y-1">
          {visibleChapters.map((chapter) =>
            navButton(chapter.id, chapter.icon, chapter.title),
          )}
        </nav>
      </div>
    </div>
  );
};
