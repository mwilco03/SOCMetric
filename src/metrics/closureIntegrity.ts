/** Closure Integrity Classification Pipeline */

import type { JiraIssue } from '../api/types';
import type { WorkSchedule } from './workingHours';
import { calculateWorkingMinutes } from './workingHours';

export type ClosureType = 
  | 'valid'
  | 'instant'
  | 'untouched'
  | 'stalled_then_closed'
  | 'churned';

export interface ClosureClassification {
  type: ClosureType;
  reason: string;
  workChurnCount: number;
  hasActiveWork: boolean;
  activeWorkMinutes: number;
}

const DEFAULT_CONFIG = {
  instantCloseThresholdMinutes: 5,
  minActiveWorkMinutes: 1,
};

export function classifyClosure(
  issue: JiraIssue,
  schedule: WorkSchedule,
  statusMapping: Record<string, 'queue' | 'active' | 'done'>,
  config = DEFAULT_CONFIG
): ClosureClassification {
  const changelog = issue.changelog?.histories || [];
  const created = new Date(issue.fields.created);
  const closed = issue.fields.resolutiondate 
    ? new Date(issue.fields.resolutiondate)
    : null;

  if (!closed) {
    return {
      type: 'valid',
      reason: 'Not yet closed',
      workChurnCount: 0,
      hasActiveWork: false,
      activeWorkMinutes: 0,
    };
  }

  // Check for instant close
  const closeMinutes = calculateWorkingMinutes(created, closed, schedule);
  if (closeMinutes < config.instantCloseThresholdMinutes) {
    return {
      type: 'instant',
      reason: `Closed within ${closeMinutes} working minutes`,
      workChurnCount: 0,
      hasActiveWork: false,
      activeWorkMinutes: closeMinutes,
    };
  }

  // Analyze changelog for status transitions
  let hasTransition = false;
  let activeWorkMinutes = 0;
  let workChurnCount = 0;
  let inActiveState = false;
  let hasBeenActive = false;
  let lastTransitionTime: Date | null = null;

  for (const history of changelog) {
    for (const item of history.items) {
      if (item.field !== 'status') continue;

      hasTransition = true;
      const transitionTime = new Date(history.created);

      const fromClass = statusMapping[item.fromString] || 'queue';
      const toClass = statusMapping[item.toString] || 'queue';

      // Track active work time
      if (inActiveState && lastTransitionTime) {
        const activeMinutes = calculateWorkingMinutes(
          lastTransitionTime,
          transitionTime,
          schedule
        );
        activeWorkMinutes += activeMinutes;
      }

      // Track churn (active -> queue -> active again)
      if (fromClass === 'active' && toClass === 'queue') {
        inActiveState = false;
      } else if (toClass === 'active') {
        if (hasBeenActive) {
          workChurnCount++; // re-entry into active = churn
        }
        inActiveState = true;
        hasBeenActive = true;
      }

      lastTransitionTime = transitionTime;
    }
  }

  // Check for untouched close (no transitions at all)
  if (!hasTransition) {
    return {
      type: 'untouched',
      reason: 'No status transitions before closure',
      workChurnCount: 0,
      hasActiveWork: false,
      activeWorkMinutes: closeMinutes,
    };
  }

  // Check for stalled-then-closed (would need stalled detection logic)
  // This is a simplified version
  const hasMeaningfulWork = activeWorkMinutes >= config.minActiveWorkMinutes;
  
  if (!hasMeaningfulWork && hasTransition) {
    return {
      type: 'stalled_then_closed',
      reason: 'Active but minimal work time before closure',
      workChurnCount,
      hasActiveWork: true,
      activeWorkMinutes,
    };
  }

  if (workChurnCount > 0) {
    return {
      type: 'churned',
      reason: `Active→Queue→Active transitions: ${workChurnCount}`,
      workChurnCount,
      hasActiveWork: true,
      activeWorkMinutes,
    };
  }

  return {
    type: 'valid',
    reason: 'Normal closure with active work',
    workChurnCount: 0,
    hasActiveWork: true,
    activeWorkMinutes,
  };
}

export function calculateIntegrityStats(
  classifications: ClosureClassification[]
): Record<ClosureType, number> {
  const stats: Record<ClosureType, number> = {
    valid: 0,
    instant: 0,
    untouched: 0,
    stalled_then_closed: 0,
    churned: 0,
  };
  
  for (const c of classifications) {
    stats[c.type]++;
  }
  
  return stats;
}

