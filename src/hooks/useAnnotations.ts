import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

const QUERY_KEY = 'dayAnnotations';

export function useAnnotations() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => invoke<Record<string, string>>('get_day_annotations'),
    staleTime: 60_000,
  });
}

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export function useSetAnnotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { date: string; annotation: string }) => {
      if (!DATE_FORMAT.test(args.date)) return Promise.reject(new Error('Invalid date format'));
      return invoke<void>('set_day_annotation', { date: args.date, annotation: args.annotation });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useDeleteAnnotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      invoke<void>('delete_day_annotation', { date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
