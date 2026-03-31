import { httpRequest } from './httpClient';
import type {
  JiraConfig,
  JiraProject,
  JiraIssue,
  SearchResponse,
  JiraStatus,
} from './types';
import {
  HTTP_TIMEOUT_MS,
  JIRA_PAGE_SIZE,
  JIRA_MAX_ISSUES,
  JIRA_RATE_LIMIT_DELAY_MS,
  JIRA_DOMAIN_PATTERN,
} from '../constants';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JiraClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: JiraConfig) {
    if (!JIRA_DOMAIN_PATTERN.test(config.domain)) {
      throw new Error('Invalid Jira domain — must be *.atlassian.net');
    }
    this.baseUrl = `https://${config.domain}/rest/api/3`;
    const auth = btoa(`${config.email}:${config.apiToken}`);
    this.headers = {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
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

    if (response.status === 401) throw new Error('Invalid Jira credentials');
    if (response.status === 403) throw new Error('Insufficient permissions');
    if (response.status === 429) throw new Error('Rate limited by Jira - please wait');
    if (response.status >= 400) throw new Error(`Jira API error: ${response.status}`);

    return response.data as T;
  }

  async testConnection(): Promise<{ displayName: string; email: string }> {
    const data = await this.request<{ displayName: string; emailAddress: string }>('/myself');
    return { displayName: data.displayName, email: data.emailAddress };
  }

  async getProjects(): Promise<JiraProject[]> {
    const data = await this.request<{ values: Array<{ id: string; key: string; name: string }> }>('/project/search');
    return data.values.map((p) => ({ id: p.id, key: p.key, name: p.name }));
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
    options: { startAt?: number; maxResults?: number; expand?: string[] } = {},
  ): Promise<{ issues: JiraIssue[]; total: number }> {
    const { startAt = 0, maxResults = JIRA_PAGE_SIZE, expand = ['changelog'] } = options;
    const data = await this.request<SearchResponse>('/search', {
      method: 'POST',
      body: {
        jql,
        startAt,
        maxResults,
        expand,
        fields: [
          'summary', 'created', 'updated', 'resolutiondate',
          'status', 'issuetype', 'priority', 'assignee',
          'reporter', 'labels', 'components',
        ],
      },
    });
    return { issues: data.issues, total: data.total };
  }

  async getAllIssues(
    jql: string,
    onProgress?: (count: number, total: number) => void,
  ): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = JIRA_PAGE_SIZE;
    let total = Infinity;

    while (startAt < total) {
      const result = await this.searchIssues(jql, { startAt, maxResults });
      allIssues.push(...result.issues);
      total = result.total;
      startAt += maxResults;
      onProgress?.(allIssues.length, total);
      if (allIssues.length >= JIRA_MAX_ISSUES) break;
      if (startAt < total) await delay(JIRA_RATE_LIMIT_DELAY_MS);
    }

    return allIssues;
  }
}

export const createJiraClient = (config: JiraConfig): JiraClient => {
  return new JiraClient(config);
};
