import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ViewMode, JiraIssue, JiraProject, JiraConfig } from '../api/types';
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
  appPhase: 'loading' | 'setup' | 'unlock' | 'dashboard';
  jiraConfig: JiraConfig | null;

  // View State
  viewMode: ViewMode;
  activeChapter: string;
  dateRange: DateRange;
  
  // Data State
  projects: JiraProject[];
  selectedProjectKeys: string[];
  irProjectKey?: string;
  issues: JiraIssue[];
  isLoading: boolean;
  error: string | null;
  
  // Configuration
  statusMappings: Record<string, Record<string, 'queue' | 'active' | 'done'>>;
  ttftAnchors: Record<string, { method: string; targetStatus?: string }>;
  workSchedule: WorkSchedule;
  ledgerEvents: LedgerEvent[];
  
  // Filters
  selectedLabels: string[];
  selectedPriorities: string[];
  dimensionFilters: DimensionFilter[];

  // Actions
  setAppPhase: (phase: 'loading' | 'setup' | 'unlock' | 'dashboard') => void;
  setJiraConfig: (config: JiraConfig | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setActiveChapter: (chapter: string) => void;
  setDateRange: (range: DateRange) => void;
  setProjects: (projects: JiraProject[]) => void;
  selectProject: (key: string) => void;
  deselectProject: (key: string) => void;
  setIrProject: (key: string) => void;
  setIssues: (issues: JiraIssue[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
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
    (set, _get) => ({
      appPhase: 'loading',
      jiraConfig: null,
      viewMode: 'lead',
      activeChapter: 'watch',
      dateRange: {
        start: new Date(Date.now() - DEFAULT_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
      projects: [],
      selectedProjectKeys: [],
      issues: [],
      isLoading: false,
      error: null,
      statusMappings: {},
      ttftAnchors: {},
      workSchedule: defaultSchedule,
      ledgerEvents: [],
      selectedLabels: [],
      selectedPriorities: [],
      dimensionFilters: [],

      setAppPhase: (phase) => set({ appPhase: phase }),
      setJiraConfig: (config) => set({ jiraConfig: config }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setActiveChapter: (chapter) => set({ activeChapter: chapter }),
      setDateRange: (range) => set({ dateRange: range }),
      setProjects: (projects) => set({ projects }),
      selectProject: (key) => set((state) => ({
        selectedProjectKeys: [...state.selectedProjectKeys, key],
      })),
      deselectProject: (key) => set((state) => ({
        selectedProjectKeys: state.selectedProjectKeys.filter((k) => k !== key),
      })),
      setIrProject: (key) => set({ irProjectKey: key }),
      setIssues: (issues) => set({ issues }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
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
      version: 1,
      partialize: (state) => ({
        viewMode: state.viewMode,
        activeChapter: state.activeChapter,
        statusMappings: state.statusMappings,
        ttftAnchors: state.ttftAnchors,
        workSchedule: state.workSchedule,
        ledgerEvents: state.ledgerEvents,
      }),
      migrate: (persisted, version) => {
        if (version === 0) {
          return persisted as Record<string, unknown>;
        }
        return persisted as Record<string, unknown>;
      },
    }
  )
);


