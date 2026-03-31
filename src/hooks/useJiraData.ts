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

  return useQuery({
    queryKey: [QUERY_KEYS.issues, projectKeys, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!jiraConfig || projectKeys.length === 0) return [];
      const client = createJiraClient(jiraConfig);
      const allIssues: JiraIssue[] = [];
      for (const key of projectKeys) {
        const jql = `project = "${key}" AND created >= "${dateRange.start.toISOString().split('T')[0]}" AND created <= "${dateRange.end.toISOString().split('T')[0]}" ORDER BY created DESC`;
        const result = await client.getAllIssues(jql);
        allIssues.push(...result);
      }
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
