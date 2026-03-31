/** Lead Time Decomposition - Queue Wait / Active Work / Post-Active Wait */

import type { JiraIssue } from '../api/types';
import type { WorkSchedule } from './workingHours';
import { calculateWorkingMinutes } from './workingHours';
import { percentile } from '../utils/statistics';

export interface LeadTimeBreakdown {
  issueKey: string;
  totalLeadTimeMinutes: number;
  queueWaitMinutes: number;
  activeWorkMinutes: number;
  postActiveWaitMinutes: number;
  transitionCount: number;
}

export interface LeadTimeAggregate {
  queueWaitP50: number;
  queueWaitP85: number;
  activeWorkP50: number;
  activeWorkP85: number;
  postActiveWaitP50: number;
  postActiveWaitP85: number;
  flowEfficiency: number;
}

export function decomposeLeadTime(
  issue: JiraIssue,
  statusMapping: Record<string, 'queue' | 'active' | 'done'>,
  schedule: WorkSchedule,
): LeadTimeBreakdown {
  const created = new Date(issue.fields.created);
  const closed = issue.fields.resolutiondate
    ? new Date(issue.fields.resolutiondate)
    : new Date();

  const totalLeadTimeMinutes = calculateWorkingMinutes(created, closed, schedule);
  const changelog = issue.changelog?.histories || [];

  // Sort transitions chronologically
  const transitions: Array<{
    time: Date;
    toClass: 'queue' | 'active' | 'done';
  }> = [];

  for (const history of changelog) {
    for (const item of history.items) {
      if (item.field !== 'status') continue;
      transitions.push({
        time: new Date(history.created),
        toClass: statusMapping[item.toString] || 'queue',
      });
    }
  }

  transitions.sort((a, b) => a.time.getTime() - b.time.getTime());

  // No transitions: entire time is queue wait
  if (transitions.length === 0) {
    return {
      issueKey: issue.key,
      totalLeadTimeMinutes,
      queueWaitMinutes: totalLeadTimeMinutes,
      activeWorkMinutes: 0,
      postActiveWaitMinutes: 0,
      transitionCount: 0,
    };
  }

  let queueWaitMinutes = 0;
  let activeWorkMinutes = 0;
  let postActiveWaitMinutes = 0;
  let currentPhase: 'queue' | 'active' | 'done' = 'queue';
  let hasBeenActive = false;
  let segmentStart = created;

  for (const transition of transitions) {
    const segmentMinutes = calculateWorkingMinutes(segmentStart, transition.time, schedule);

    if (currentPhase === 'queue') {
      if (hasBeenActive) {
        postActiveWaitMinutes += segmentMinutes;
      } else {
        queueWaitMinutes += segmentMinutes;
      }
    } else if (currentPhase === 'active') {
      activeWorkMinutes += segmentMinutes;
    }
    // 'done' phase time is not counted

    currentPhase = transition.toClass;
    if (currentPhase === 'active') hasBeenActive = true;
    segmentStart = transition.time;
  }

  // Final segment from last transition to close
  if (currentPhase !== 'done') {
    const finalMinutes = calculateWorkingMinutes(segmentStart, closed, schedule);
    if (currentPhase === 'active') {
      activeWorkMinutes += finalMinutes;
    } else if (currentPhase === 'queue') {
      if (hasBeenActive) {
        postActiveWaitMinutes += finalMinutes;
      } else {
        queueWaitMinutes += finalMinutes;
      }
    }
  }

  return {
    issueKey: issue.key,
    totalLeadTimeMinutes,
    queueWaitMinutes,
    activeWorkMinutes,
    postActiveWaitMinutes,
    transitionCount: transitions.length,
  };
}

export function aggregateLeadTimes(
  breakdowns: LeadTimeBreakdown[],
): LeadTimeAggregate {
  if (breakdowns.length === 0) {
    return {
      queueWaitP50: 0, queueWaitP85: 0,
      activeWorkP50: 0, activeWorkP85: 0,
      postActiveWaitP50: 0, postActiveWaitP85: 0,
      flowEfficiency: 0,
    };
  }

  const qw = breakdowns.map((b) => b.queueWaitMinutes / 60);
  const aw = breakdowns.map((b) => b.activeWorkMinutes / 60);
  const paw = breakdowns.map((b) => b.postActiveWaitMinutes / 60);

  const totalActive = breakdowns.reduce((s, b) => s + b.activeWorkMinutes, 0);
  const totalLead = breakdowns.reduce((s, b) => s + b.totalLeadTimeMinutes, 0);

  return {
    queueWaitP50: percentile(qw, 50),
    queueWaitP85: percentile(qw, 85),
    activeWorkP50: percentile(aw, 50),
    activeWorkP85: percentile(aw, 85),
    postActiveWaitP50: percentile(paw, 50),
    postActiveWaitP85: percentile(paw, 85),
    flowEfficiency: totalLead > 0 ? (totalActive / totalLead) * 100 : 0,
  };
}
