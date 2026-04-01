import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ViewMode } from '../types';
import type { WorkSchedule } from '../metrics/workingHours';
import type { DimensionFilter } from '../dimensions/dimensionEngine';
import { DEFAULT_DATE_RANGE_DAYS } from '../constants';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface LedgerEvent {
  id: string;
  type: 'absence' | 'new_hire' | 'system_downtime' | 'rule_deployment' | 'holiday' | 'incident' | 'audit';
  startDate: string;
  endDate: string;
  description: string;
  scope: 'all' | 'shift' | 'analyst';
  shiftName?: string;
  impact?: number;
}

export interface DashboardState {
  // App Phase
  appPhase: 'loading' | 'setup' | 'dashboard';

  // Project (single project, stored in SQLite via Rust)
  projectKey: string | null;

  // View State
  viewMode: ViewMode;
  activeChapter: string;
  dateRange: DateRange;

  // Configuration (persisted locally for UI)
  statusMappings: Record<string, Record<string, 'queue' | 'active' | 'done'>>;
  ttftAnchors: Record<string, { method: string; targetStatus?: string }>;
  workSchedule: WorkSchedule;
  ledgerEvents: LedgerEvent[];

  // Filters
  selectedLabels: string[];
  selectedPriorities: string[];
  dimensionFilters: DimensionFilter[];

  // Actions
  setAppPhase: (phase: 'loading' | 'setup' | 'dashboard') => void;
  setProjectKey: (key: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setActiveChapter: (chapter: string) => void;
  setDateRange: (range: DateRange) => void;
  setStatusMapping: (projectKey: string, status: string, classification: 'queue' | 'active' | 'done') => void;
  addLedgerEvent: (event: LedgerEvent) => void;
  removeLedgerEvent: (id: string) => void;
  setWorkSchedule: (schedule: WorkSchedule) => void;
  setDimensionFilters: (filters: DimensionFilter[]) => void;
}

const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const defaultSchedule: WorkSchedule = {
  timezone: systemTimezone,
  shifts: [
    {
      name: 'Day',
      timezone: systemTimezone,
      startHour: 9,
      endHour: 17,
      workDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      baseHeadcount: 1,
    },
  ],
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      appPhase: 'loading',
      projectKey: null,
      viewMode: 'lead',
      activeChapter: 'watch',
      dateRange: {
        start: new Date(Date.now() - DEFAULT_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
      statusMappings: {},
      ttftAnchors: {},
      workSchedule: defaultSchedule,
      ledgerEvents: [],
      selectedLabels: [],
      selectedPriorities: [],
      dimensionFilters: [],

      setAppPhase: (phase) => set({ appPhase: phase }),
      setProjectKey: (key) => set({ projectKey: key }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setActiveChapter: (chapter) => set({ activeChapter: chapter }),
      setDateRange: (range) => set({ dateRange: range }),
      setStatusMapping: (projectKey, status, classification) =>
        set((state) => ({
          statusMappings: {
            ...state.statusMappings,
            [projectKey]: {
              ...state.statusMappings[projectKey],
              [status]: classification,
            },
          },
        })),
      addLedgerEvent: (event) =>
        set((state) => ({
          ledgerEvents: [...state.ledgerEvents, event],
        })),
      removeLedgerEvent: (id) =>
        set((state) => ({
          ledgerEvents: state.ledgerEvents.filter((e) => e.id !== id),
        })),
      setWorkSchedule: (schedule) => set({ workSchedule: schedule }),
      setDimensionFilters: (filters) => set({ dimensionFilters: filters }),
    }),
    {
      name: 'soc-dashboard-storage',
      version: 2,
      partialize: (state) => ({
        viewMode: state.viewMode,
        activeChapter: state.activeChapter,
        projectKey: state.projectKey,
        statusMappings: state.statusMappings,
        ttftAnchors: state.ttftAnchors,
        workSchedule: state.workSchedule,
        ledgerEvents: state.ledgerEvents,
        dimensionFilters: state.dimensionFilters,
      }),
      migrate: (persisted, version) => {
        if (version < 2) {
          return { ...(persisted as Record<string, unknown>), projectKey: null };
        }
        return persisted as Record<string, unknown>;
      },
    }
  )
);
