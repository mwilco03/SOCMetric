import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardStore } from '../store/dashboardStore';
import { toISODate } from '../utils/dateUtils';
import { IDLE_SYNC_LOOKBACK_DAYS, IDLE_TIMEOUT_MS, ACTIVITY_THROTTLE_MS } from '../constants';

export function useIdleSync() {
  const projectKey = useDashboardStore((s) => s.projectKey);
  const setAppPhase = useDashboardStore((s) => s.setAppPhase);
  const queryClient = useQueryClient();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncing = useRef(false);
  const lastActivity = useRef(0);

  useEffect(() => {
    if (!projectKey) return;

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(startIdleSync, IDLE_TIMEOUT_MS);
    };

    const startIdleSync = async () => {
      if (syncing.current) return;
      syncing.current = true;
      try {
        const end = new Date();
        const start = new Date(Date.now() - IDLE_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
        await invoke('sync_project', {
          projectKey: projectKey,
          startDate: toISODate(start),
          endDate: toISODate(end),
        });
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        queryClient.invalidateQueries({ queryKey: ['openTickets'] });
        queryClient.invalidateQueries({ queryKey: ['syncState'] });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Auth failures should surface — credentials may have expired
        if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
          setAppPhase('setup');
          return;
        }
        // Other errors (rate limit, network, sync in progress) — silently retry next idle
      } finally {
        syncing.current = false;
      }
    };

    const stopOnActivity = () => {
      const now = Date.now();
      if (now - lastActivity.current < ACTIVITY_THROTTLE_MS) return;
      lastActivity.current = now;
      resetTimer();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (idleTimer.current) clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(startIdleSync, IDLE_TIMEOUT_MS);
      } else {
        resetTimer();
      }
    };

    resetTimer();

    window.addEventListener('mousemove', stopOnActivity);
    window.addEventListener('keydown', stopOnActivity);
    window.addEventListener('mousedown', stopOnActivity);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      window.removeEventListener('mousemove', stopOnActivity);
      window.removeEventListener('keydown', stopOnActivity);
      window.removeEventListener('mousedown', stopOnActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [projectKey, queryClient, setAppPhase]);
}
