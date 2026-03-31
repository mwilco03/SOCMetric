/** Status Discovery — auto-detect classifications from Jira statusCategory */

import type { JiraStatus } from '../api/types';

export interface DiscoveredMapping {
  status: string;
  suggestedClassification: 'queue' | 'active' | 'done';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

// Known status name patterns for refinement
const QUEUE_PATTERNS = ['waiting', 'pending', 'blocked', 'on hold', 'backlog', 'to do', 'open', 'new'];
const ACTIVE_PATTERNS = ['in progress', 'in review', 'investigating', 'working', 'active', 'assigned'];
const DONE_PATTERNS = ['done', 'closed', 'resolved', 'complete', 'cancelled', 'won\'t do'];

function matchesAny(name: string, patterns: string[]): boolean {
  const lower = name.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

export function discoverStatusMappings(statuses: JiraStatus[]): DiscoveredMapping[] {
  return statuses.map((status) => {
    const categoryKey = status.statusCategory.key;
    const name = status.name;

    // Start from Jira's own category
    let classification: 'queue' | 'active' | 'done';
    let confidence: 'high' | 'medium' | 'low';
    let reason: string;

    if (categoryKey === 'done') {
      classification = 'done';
      confidence = 'high';
      reason = `Jira category: ${status.statusCategory.name}`;
    } else if (categoryKey === 'indeterminate') {
      // indeterminate = "in progress" in Jira — but some are actually queue
      if (matchesAny(name, QUEUE_PATTERNS)) {
        classification = 'queue';
        confidence = 'medium';
        reason = `Jira says in-progress but name suggests queue ("${name}")`;
      } else {
        classification = 'active';
        confidence = 'high';
        reason = `Jira category: ${status.statusCategory.name}`;
      }
    } else {
      // 'new' or 'undefined' category = queue
      if (matchesAny(name, ACTIVE_PATTERNS)) {
        classification = 'active';
        confidence = 'medium';
        reason = `Jira says new/todo but name suggests active ("${name}")`;
      } else if (matchesAny(name, DONE_PATTERNS)) {
        classification = 'done';
        confidence = 'medium';
        reason = `Jira says new/todo but name suggests done ("${name}")`;
      } else {
        classification = 'queue';
        confidence = 'high';
        reason = `Jira category: ${status.statusCategory.name}`;
      }
    }

    return {
      status: name,
      suggestedClassification: classification,
      confidence,
      reason,
    };
  });
}

export function discoverTTFTAnchor(
  discoveredMappings: DiscoveredMapping[],
): { method: string; targetStatus?: string; confidence: 'high' | 'medium' | 'low' } {
  // Find the first active status — that's the TTFT anchor target
  const activeStatuses = discoveredMappings.filter((m) => m.suggestedClassification === 'active');

  if (activeStatuses.length === 1) {
    return {
      method: 'status_transition',
      targetStatus: activeStatuses[0].status,
      confidence: 'high',
    };
  }

  if (activeStatuses.length > 1) {
    // Pick the highest confidence one
    const best = activeStatuses.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.confidence] - order[b.confidence];
    })[0];
    return {
      method: 'status_transition',
      targetStatus: best.status,
      confidence: 'medium',
    };
  }

  // No active statuses found — fall back to "any transition away from initial"
  return {
    method: 'first_transition',
    confidence: 'low',
  };
}
