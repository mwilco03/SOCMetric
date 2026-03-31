/** Jira API Response Types */

export interface JiraConfig {
  domain: string;
  email: string;
  apiToken: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    id: number;
    key: string;
    name: string;
  };
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

export interface ChangelogItem {
  field: string;
  fromString: string;
  toString: string;
}

export interface ChangelogHistory {
  id: string;
  created: string;
  author: JiraUser;
  items: ChangelogItem[];
}

export interface Changelog {
  histories: ChangelogHistory[];
  total: number;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    created: string;
    updated: string;
    resolutiondate?: string;
    status: JiraStatus;
    issuetype: {
      id: string;
      name: string;
    };
    priority?: {
      id: string;
      name: string;
    };
    assignee?: JiraUser;
    reporter: JiraUser;
    labels: string[];
    components: Array<{ id: string; name: string }>;
  };
  changelog?: Changelog;
}

export interface SearchResponse {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export type ViewMode = 'analyst' | 'lead' | 'executive';

export type StatusClassification = 'queue' | 'active' | 'done';

export interface StatusMapping {
  [statusName: string]: StatusClassification;
}

export interface TTFTAnchor {
  method: 'status_transition' | 'any_non_initial' | 'assignee_populated';
  targetStatus?: string;
}

