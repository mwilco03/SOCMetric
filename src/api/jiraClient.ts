import { httpRequest } from './httpClient';
import type {
  JiraConfig,
  JiraProject,
  JiraIssue,
  JiraStatus,
} from './types';
import {
  HTTP_TIMEOUT_MS,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_RATE_LIMITED,
  HTTP_STATUS_BAD_REQUEST,
  MEDIA_TYPE_JSON,
  JIRA_PAGE_SIZE,
  JIRA_PROJECTS_PAGE_SIZE,
  JIRA_MAX_ISSUES,
  JIRA_RATE_LIMIT_DELAY_MS,
  JIRA_DOMAIN_PATTERN,
  JIRA_ENDPOINT_MYSELF,
  JIRA_ENDPOINT_PROJECT_SEARCH,
  JIRA_ENDPOINT_SEARCH,
  JIRA_SEARCH_FIELDS,
  JIRA_EXPAND_DEFAULT,
} from '../constants';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JiraClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: JiraConfig) {
    const domain = config.domain
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .trim();

    if (!JIRA_DOMAIN_PATTERN.test(domain)) {
      throw new Error(`Invalid Jira domain "${domain}" — must be yourorg.atlassian.net`);
    }
    this.baseUrl = `https://${domain}/rest/api/3`;
    const auth = btoa(`${config.email}:${config.apiToken}`);
    this.headers = {
      Authorization: `Basic ${auth}`,
      Accept: MEDIA_TYPE_JSON,
      'Content-Type': MEDIA_TYPE_JSON,
    };
  }

  private async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await httpRequest(url, {
      method: options.method || 'GET',
      headers: this.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      timeout: HTTP_TIMEOUT_MS,
    });

    if (response.status === HTTP_STATUS_UNAUTHORIZED) throw new Error('Invalid Jira credentials');
    if (response.status === HTTP_STATUS_FORBIDDEN) throw new Error('Insufficient permissions');
    if (response.status === HTTP_STATUS_RATE_LIMITED) throw new Error('Rate limited by Jira — please wait');
    if (response.status >= HTTP_STATUS_BAD_REQUEST) {
      throw new Error(`Jira API error ${response.status}: ${JSON.stringify(response.data)}`);
    }

    return response.data as T;
  }

  async testConnection(): Promise<{ displayName: string; email: string }> {
    const data = await this.request<{ displayName: string; emailAddress: string }>(JIRA_ENDPOINT_MYSELF);
    return { displayName: data.displayName, email: data.emailAddress };
  }

  async getProjects(): Promise<JiraProject[]> {
    const allProjects: JiraProject[] = [];
    let startAt = 0;

    while (true) {
      const data = await this.request<{
        values: Array<{ id: string; key: string; name: string }>;
        total: number;
        isLast?: boolean;
      }>(`${JIRA_ENDPOINT_PROJECT_SEARCH}?startAt=${startAt}&maxResults=${JIRA_PROJECTS_PAGE_SIZE}`);

      allProjects.push(...data.values.map((p) => ({ id: p.id, key: p.key, name: p.name })));

      if (data.isLast || allProjects.length >= data.total || data.values.length < JIRA_PROJECTS_PAGE_SIZE) break;
      startAt += JIRA_PROJECTS_PAGE_SIZE;
    }

    return allProjects.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProjectStatuses(projectKey: string): Promise<JiraStatus[]> {
    const data = await this.request<Array<{ statuses: Array<{ id: string; name: string; statusCategory: { id: number; key: string; name: string } }> }>>(`/project/${projectKey}/statuses`);
    const statuses: JiraStatus[] = [];
    data.forEach((issueType) => {
      issueType.statuses.forEach((status) => {
        if (!statuses.find((s) => s.id === status.id)) {
          statuses.push({
            id: status.id,
            name: status.name,
            statusCategory: status.statusCategory,
          });
        }
      });
    });
    return statuses;
  }

  async searchIssues(
    jql: string,
    options: { nextPageToken?: string; maxResults?: number; expand?: string } = {},
  ): Promise<{ issues: JiraIssue[]; nextPageToken?: string; isLast?: boolean }> {
    const { maxResults = JIRA_PAGE_SIZE, expand = JIRA_EXPAND_DEFAULT, nextPageToken } = options;
    const body: Record<string, unknown> = {
      jql,
      maxResults,
      expand,
      fields: [...JIRA_SEARCH_FIELDS],
    };
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }
    const data = await this.request<{ issues: JiraIssue[]; nextPageToken?: string; isLast?: boolean }>(JIRA_ENDPOINT_SEARCH, {
      method: 'POST',
      body,
    });
    return { issues: data.issues, nextPageToken: data.nextPageToken, isLast: data.isLast };
  }

  async getAllIssues(
    jql: string,
    onProgress?: (count: number, total: number) => void,
  ): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let nextPageToken: string | undefined;

    while (true) {
      const result = await this.searchIssues(jql, { nextPageToken, maxResults: JIRA_PAGE_SIZE });
      allIssues.push(...result.issues);
      onProgress?.(allIssues.length, allIssues.length);

      if (result.isLast || !result.nextPageToken || allIssues.length >= JIRA_MAX_ISSUES) break;
      nextPageToken = result.nextPageToken;
      await delay(JIRA_RATE_LIMIT_DELAY_MS);
    }

    return allIssues;
  }
}

export const createJiraClient = (config: JiraConfig): JiraClient => {
  return new JiraClient(config);
};
