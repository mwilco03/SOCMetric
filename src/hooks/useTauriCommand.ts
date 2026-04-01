import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface CommandState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

export function useTauriCommand<T>() {
  const [state, setState] = useState<CommandState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const execute = useCallback(async (command: string, args?: Record<string, unknown>): Promise<T> => {
    setState({ data: null, error: null, isLoading: true });
    try {
      const result = await invoke<T>(command, args);
      setState({ data: result, error: null, isLoading: false });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ data: null, error: msg, isLoading: false });
      throw e;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return { ...state, execute, reset };
}

/** Fire-and-forget invoke helper for simple calls */
export async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args);
}
