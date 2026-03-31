import { useDashboardStore } from '../store/dashboardStore';

export function useJiraLink(): (key: string) => string {
  const domain = useDashboardStore((s) => s.jiraConfig?.domain ?? '');
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return (key: string) => `https://${cleanDomain}/browse/${key}`;
}
