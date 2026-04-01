import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { toISODate } from '../utils/dateUtils';
import type { TicketRow, JiraProject, JiraUser, JiraStatus, DiscoveredMapping, SyncProgress, SyncComplete, SyncState, Credential } from '../types';

const QUERY_KEYS = {
  credentials: 'credentials',
  projects: 'projects',
  tickets: 'tickets',
  openTickets: 'openTickets',
  syncState: 'syncState',
  projectStatuses: (key: string) => ['statuses', key],
};

export function useCredentials() {
  return useQuery({
    queryKey: [QUERY_KEYS.credentials],
    queryFn: () => invoke<Credential | null>('get_credentials'),
    staleTime: Infinity,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: [QUERY_KEYS.projects],
    queryFn: () => invoke<JiraProject[]>('get_projects'),
  });
}

export function useProjectStatuses(projectKey: string) {
  return useQuery({
    queryKey: QUERY_KEYS.projectStatuses(projectKey),
    queryFn: () => invoke<JiraStatus[]>('get_project_statuses', { project_key: projectKey }),
    enabled: !!projectKey,
  });
}

export function useTickets() {
  const projectKey = useDashboardStore((s) => s.projectKey);
  const dateRange = useDashboardStore((s) => s.dateRange);

  return useQuery({
    queryKey: [QUERY_KEYS.tickets, projectKey, toISODate(dateRange.start), toISODate(dateRange.end)],
    queryFn: () =>
      invoke<TicketRow[]>('get_tickets', {
        project_key: projectKey!,
        start_date: toISODate(dateRange.start),
        end_date: toISODate(dateRange.end),
      }),
    enabled: !!projectKey,
  });
}

export function useOpenTickets() {
  const projectKey = useDashboardStore((s) => s.projectKey);

  return useQuery({
    queryKey: [QUERY_KEYS.openTickets, projectKey],
    queryFn: () => invoke<TicketRow[]>('get_open_tickets', { project_key: projectKey! }),
    enabled: !!projectKey,
  });
}

export function useSyncState() {
  const projectKey = useDashboardStore((s) => s.projectKey);

  return useQuery({
    queryKey: [QUERY_KEYS.syncState, projectKey],
    queryFn: () => invoke<SyncState | null>('get_sync_state', { project_key: projectKey! }),
    enabled: !!projectKey,
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (args: { domain: string; email: string; apiToken: string }) =>
      invoke<JiraUser>('test_connection', {
        domain: args.domain,
        email: args.email,
        api_token: args.apiToken,
      }),
  });
}

export function useSetCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { domain: string; email: string; apiToken: string }) =>
      invoke<void>('set_credentials', {
        domain: args.domain,
        email: args.email,
        api_token: args.apiToken,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.credentials] }),
  });
}

export function useDiscoverStatuses() {
  return useMutation({
    mutationFn: (projectKey: string) =>
      invoke<DiscoveredMapping[]>('discover_statuses', { project_key: projectKey }),
  });
}

export function useSyncProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { projectKey: string; startDate: string; endDate: string }) =>
      invoke<SyncComplete>('sync_project', {
        project_key: args.projectKey,
        start_date: args.startDate,
        end_date: args.endDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tickets] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.openTickets] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.syncState] });
    },
  });
}

export function useSyncProgress() {
  const [progress, setProgress] = useState<SyncProgress | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<SyncProgress>('sync:progress', (event) => {
      setProgress(event.payload);
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, []);

  return progress;
}
