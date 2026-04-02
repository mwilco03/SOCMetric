import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { LabelConfig } from '../types';

const QUERY_KEY = 'labelConfig';

export function useLabelConfig() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => invoke<LabelConfig[]>('get_label_config'),
    staleTime: 60_000,
  });
}

export function useSetLabelIncluded() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { label: string; included: boolean }) =>
      invoke<void>('set_label_included', { label: args.label, included: args.included }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
