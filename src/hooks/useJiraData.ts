import { useQuery, useMutation } from '@tanstack/react-query';
import { createJiraClient } from '../api/jiraClient';
import { useDashboardStore } from '../store/dashboardStore';
import type { JiraConfig, JiraIssue } from '../api/types';

const QUERY_KEYS = {
  projects: 'projects',
  issues: 'issues',
  projectStatuses: (key: string) => ['statuses', key],
};

export function useProjects() {
  const jiraConfig = useDashboardStore((s) => s.jiraConfig);
  return useQuery({
    queryKey: [QUERY_KEYS.projects],
    queryFn: async () => {
      if (!jiraConfig) throw new Error('No config');
      const client = createJiraClient(jiraConfig);
      return client.getProjects();
    },
    enabled: !!jiraConfig,
  });
}

export function useProjectStatuses(projectKey: string) {
  const jiraConfig = useDashboardStore((s) => s.jiraConfig);
  return useQuery({
    queryKey: QUERY_KEYS.projectStatuses(projectKey),
    queryFn: async () => {
      if (!jiraConfig) throw new Error('No config');
      const client = createJiraClient(jiraConfig);
      return client.getProjectStatuses(projectKey);
    },
    enabled: !!jiraConfig && !!projectKey,
  });
}

export function useIssues() {
  const jiraConfig = useDashboardStore((s) => s.jiraConfig);
  const projectKeys = useDashboardStore((s) => s.selectedProjectKeys);
  const dateRange = useDashboardStore((s) => s.dateRange);
  const setLastRefreshed = useDashboardStore((s) => s.setLastRefreshed);

  return useQuery({
    queryKey: [QUERY_KEYS.issues, projectKeys, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!jiraConfig || projectKeys.length === 0) return [];
      const client = createJiraClient(jiraConfig);
      const allIssues: JiraIssue[] = [];
      for (const key of projectKeys) {
        const startDate = dateRange.start.toISOString().split('T')[0];
        const endDate = dateRange.end.toISOString().split('T')[0];
        const jql = `project = ${key} AND created >= "${startDate}" AND created <= "${endDate}" ORDER BY created DESC`;
        const result = await client.getAllIssues(jql);
        allIssues.push(...result);
      }
      setLastRefreshed(new Date());
      return allIssues;
    },
    enabled: !!jiraConfig && projectKeys.length > 0,
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (config: JiraConfig) => {
      const client = createJiraClient(config);
      return client.testConnection();
    },
  });
}
