/** HTTP client adapter - works in both browser and Tauri contexts */

import { HTTP_TIMEOUT_MS, HEADER_CONTENT_TYPE, MEDIA_TYPE_JSON, ERROR_TRUNCATE_LENGTH } from '../constants';

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

async function parseResponse(response: Response): Promise<{ data: unknown; headers: Record<string, string> }> {
  let data: unknown;
  const contentType = response.headers.get(HEADER_CONTENT_TYPE) || '';
  if (contentType.includes(MEDIA_TYPE_JSON)) {
    data = await response.json();
  } else {
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, ERROR_TRUNCATE_LENGTH) };
    }
  }
  return { data, headers: Object.fromEntries(response.headers.entries()) };
}

async function tauriFetch(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
  const { fetch } = await import('@tauri-apps/plugin-http');
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body || undefined,
  });
  const { data, headers } = await parseResponse(response);
  return { status: response.status, data, headers };
}

async function nativeFetch(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
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
    const { data, headers } = await parseResponse(response);
    return { status: response.status, data, headers };
  } finally {
    clearTimeout(timer);
  }
}

export async function httpRequest(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
  try {
    return await tauriFetch(url, options);
  } catch (tauriError) {
    if (
      tauriError instanceof TypeError ||
      String(tauriError).includes('not a function')
    ) {
      return nativeFetch(url, options);
    }
    throw tauriError;
  }
}
