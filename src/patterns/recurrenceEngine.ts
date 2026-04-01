/** Recurrence Engine - Rapid and Slow Recurrence Detection */

import { differenceInDays } from 'date-fns';
import { normalizeTitle } from '../normalization/entityNormalizer';
import { calculateWorkingHours } from '../metrics/workingHours';
import type { WorkSchedule } from '../metrics/workingHours';
import type { JiraIssue } from '../types';

export interface RecurrenceConfig {
  rapidThresholdHours: number;
  slowThresholdDays: number;
  similarityThreshold: number;
}

export const DEFAULT_RECURRENCE_CONFIG: RecurrenceConfig = {
  rapidThresholdHours: 24,
  slowThresholdDays: 14,
  similarityThreshold: 0.6,
};

// Jaccard similarity for token sets
function jaccardSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.toLowerCase().split(/\s+/));
  const tokens2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

export type RecurrenceType = 'rapid' | 'slow' | null;

export interface RecurrenceResult {
  isRecurrence: boolean;
  type: RecurrenceType;
  originalIssue?: JiraIssue;
  similarity: number;
  hoursSinceOriginal: number;
}

export function detectRecurrence(
  issue: JiraIssue,
  closedIssues: JiraIssue[],
  schedule: WorkSchedule,
  config: RecurrenceConfig = DEFAULT_RECURRENCE_CONFIG
): RecurrenceResult {
  const { normalized: currentNorm } = normalizeTitle(issue.fields.summary);
  const issueCreated = new Date(issue.fields.created);
  
  let bestMatch: { issue: JiraIssue; similarity: number; hoursDiff: number } | null = null;
  
  for (const closed of closedIssues) {
    const closedDate = closed.fields.resolutiondate 
      ? new Date(closed.fields.resolutiondate)
      : null;
    if (!closedDate || closedDate >= issueCreated) continue;
    
    const { normalized: closedNorm } = normalizeTitle(closed.fields.summary);
    const similarity = jaccardSimilarity(currentNorm, closedNorm);
    
    if (similarity >= config.similarityThreshold) {
      const hoursDiff = calculateWorkingHours(closedDate, issueCreated, schedule);
      
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { issue: closed, similarity, hoursDiff };
      }
    }
  }
  
  if (!bestMatch) {
    return { isRecurrence: false, type: null, similarity: 0, hoursSinceOriginal: 0 };
  }
  
  const workingHoursDiff = bestMatch.hoursDiff;
  
  // Rapid recurrence: within 24 working hours
  if (workingHoursDiff <= config.rapidThresholdHours) {
    return {
      isRecurrence: true,
      type: 'rapid',
      originalIssue: bestMatch.issue,
      similarity: bestMatch.similarity,
      hoursSinceOriginal: workingHoursDiff,
    };
  }
  
  // Slow recurrence: within 14 days
  const daysDiff = differenceInDays(issueCreated, new Date(bestMatch.issue.fields.resolutiondate!));
  if (daysDiff <= config.slowThresholdDays) {
    return {
      isRecurrence: true,
      type: 'slow',
      originalIssue: bestMatch.issue,
      similarity: bestMatch.similarity,
      hoursSinceOriginal: workingHoursDiff,
    };
  }
  
  return { isRecurrence: false, type: null, similarity: bestMatch.similarity, hoursSinceOriginal: workingHoursDiff };
}

export interface RecurrenceStats {
  rapidCount: number;
  slowCount: number;
  rapidRate: number;
  slowRate: number;
  totalRecurrenceWorkHours: number;
  totalWorkHours: number;
  wastedWorkRatio: number;
  byCluster: Map<string, { rapid: number; slow: number; total: number }>;
}

export function calculateRecurrenceStats(
  issues: JiraIssue[],
  schedule: WorkSchedule,
  config?: RecurrenceConfig
): RecurrenceStats {
  const closedIssues = issues.filter(i => i.fields.resolutiondate);
  const results: RecurrenceResult[] = [];
  
  for (const issue of issues) {
    const priorClosed = closedIssues.filter(
      c => new Date(c.fields.resolutiondate!) < new Date(issue.fields.created)
    );
    results.push(detectRecurrence(issue, priorClosed, schedule, config));
  }
  
  const rapidCount = results.filter(r => r.type === 'rapid').length;
  const slowCount = results.filter(r => r.type === 'slow').length;

  // Compute work-hour weighted wasted work ratio
  let totalRecurrenceWorkHours = 0;
  let totalWorkHours = 0;

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    const created = new Date(issue.fields.created);
    const resolved = issue.fields.resolutiondate
      ? new Date(issue.fields.resolutiondate)
      : new Date();
    const hours = calculateWorkingHours(created, resolved, schedule);
    totalWorkHours += hours;
    if (results[i].isRecurrence) {
      totalRecurrenceWorkHours += hours;
    }
  }

  return {
    rapidCount,
    slowCount,
    rapidRate: issues.length > 0 ? rapidCount / issues.length : 0,
    slowRate: issues.length > 0 ? slowCount / issues.length : 0,
    totalRecurrenceWorkHours,
    totalWorkHours,
    wastedWorkRatio: totalWorkHours > 0 ? totalRecurrenceWorkHours / totalWorkHours : 0,
    byCluster: new Map(),
  };
}

