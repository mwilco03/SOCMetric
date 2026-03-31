/** Dimension Engine — cross-dimension extraction and filtering */

import type { JiraIssue } from '../api/types';

export type DimensionKey = 'priority' | 'label' | 'component' | 'issueType' | 'status';

export interface DimensionFilter {
  dimension: DimensionKey;
  values: string[];
}

export interface DimensionOption {
  value: string;
  count: number;
}

export function extractDimensions(
  issues: JiraIssue[],
): Record<DimensionKey, DimensionOption[]> {
  const counts: Record<DimensionKey, Map<string, number>> = {
    priority: new Map(),
    label: new Map(),
    component: new Map(),
    issueType: new Map(),
    status: new Map(),
  };

  for (const issue of issues) {
    // Priority
    const priority = issue.fields.priority?.name ?? 'None';
    counts.priority.set(priority, (counts.priority.get(priority) ?? 0) + 1);

    // Labels
    for (const label of issue.fields.labels) {
      counts.label.set(label, (counts.label.get(label) ?? 0) + 1);
    }

    // Components
    for (const comp of issue.fields.components) {
      counts.component.set(comp.name, (counts.component.get(comp.name) ?? 0) + 1);
    }

    // Issue type
    const type = issue.fields.issuetype.name;
    counts.issueType.set(type, (counts.issueType.get(type) ?? 0) + 1);

    // Status
    const status = issue.fields.status.name;
    counts.status.set(status, (counts.status.get(status) ?? 0) + 1);
  }

  const toOptions = (map: Map<string, number>): DimensionOption[] =>
    [...map.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  return {
    priority: toOptions(counts.priority),
    label: toOptions(counts.label),
    component: toOptions(counts.component),
    issueType: toOptions(counts.issueType),
    status: toOptions(counts.status),
  };
}

function getIssueValue(issue: JiraIssue, dimension: DimensionKey): string[] {
  switch (dimension) {
    case 'priority': return [issue.fields.priority?.name ?? 'None'];
    case 'label': return issue.fields.labels;
    case 'component': return issue.fields.components.map((c) => c.name);
    case 'issueType': return [issue.fields.issuetype.name];
    case 'status': return [issue.fields.status.name];
  }
}

export function filterByDimensions(
  issues: JiraIssue[],
  filters: DimensionFilter[],
): JiraIssue[] {
  if (filters.length === 0) return issues;

  return issues.filter((issue) =>
    filters.every((filter) => {
      if (filter.values.length === 0) return true;
      const issueValues = getIssueValue(issue, filter.dimension);
      return issueValues.some((v) => filter.values.includes(v));
    }),
  );
}
