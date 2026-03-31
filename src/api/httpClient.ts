/** HTTP client adapter - works in both browser and Tauri contexts */

import { HTTP_TIMEOUT_MS } from '../constants';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

interface HttpResponse {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

function isInTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

async function tauriFetch(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
  // Dynamic import to avoid bundling issues when not in Tauri
  const { fetch } = await import('@tauri-apps/plugin-http');
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body ? JSON.parse(options.body) : undefined,
  });
  const data = await response.json();
  return {
    status: response.status,
    data,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

async function browserFetch(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
  const controller = new AbortController();
  const timeout = options.timeout || HTTP_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await globalThis.fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body || undefined,
      signal: controller.signal,
    });
    const data = await response.json();
    return {
      status: response.status,
      data,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function httpRequest(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
  if (isInTauri()) {
    return tauriFetch(url, options);
  }
  return browserFetch(url, options);
}
