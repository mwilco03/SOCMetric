import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useDashboardStore } from '../store/dashboardStore';

const QUERY_KEY = 'statusMappings';

export function useStatusMappingsFromDb() {
  const projectKey = useDashboardStore((s) => s.projectKey);
  return useQuery({
    queryKey: [QUERY_KEY, projectKey],
    queryFn: () => invoke<Record<string, string>>('get_status_mappings', { project_key: projectKey! }),
    enabled: !!projectKey,
  });
}

export function useSetStatusMapping() {
  const queryClient = useQueryClient();
  const projectKey = useDashboardStore((s) => s.projectKey);
  return useMutation({
    mutationFn: (args: { statusName: string; classification: string }) => {
      if (!projectKey) return Promise.reject(new Error('No project selected'));
      return invoke<void>('set_status_mapping', {
        project_key: projectKey,
        status_name: args.statusName,
        classification: args.classification,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY, projectKey] }),
  });
}
