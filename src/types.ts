/**
 * Core types for SOCMetric v2.
 * TicketRow/Credential match Rust serde output.
 * JiraIssue/ViewMode/etc. used by metric engines.
 */

// --- Rust backend types (match serde output exactly) ---

export interface TicketRow {
  id: string;
  key: string;
  project_key: string;
  summary: string;
  status_name: string;
  status_category_key: string;
  issue_type: string;
  priority: string | null;
  assignee: string | null;
  reporter: string | null;
  labels: string[];
  components: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  changelog_json: string | null;
  fetched_at: string;
}

export interface Credential {
  domain: string;
  email: string;
  api_token: string;
}

export interface SyncState {
  project_key: string;
  newest_fetched: string | null;
  oldest_fetched: string | null;
  total_fetched: number;
  last_sync_at: string | null;
}

export interface SyncProgress {
  project_key: string;
  fetched: number;
  direction: string;
  phase: string;
}

export interface SyncComplete {
  project_key: string;
  total_stored: number;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraUser {
  display_name: string;
  email: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  category_key: string;
  category_name: string;
}

export interface DiscoveredMapping {
  status_name: string;
  classification: string;
  confidence: string;
}

export interface LabelConfig {
  label: string;
  included: boolean;
}

// --- Frontend types (used by metric engines) ---

export type ViewMode = 'analyst' | 'lead' | 'executive';

export type StatusClassification = 'queue' | 'active' | 'done' | 'blocked';

export interface StatusMapping {
  [statusName: string]: StatusClassification;
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
    status: {
      id: string;
      name: string;
      statusCategory: {
        id: number;
        key: string;
        name: string;
      };
    };
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

export interface TTFTAnchor {
  method: 'status_transition' | 'any_non_initial' | 'assignee_populated';
  targetStatus?: string;
}
