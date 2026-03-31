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

async function tauriFetch(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
  const { fetch } = await import('@tauri-apps/plugin-http');
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body || undefined,
  });

  // Handle non-JSON responses gracefully
  let data: unknown;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 200) };
    }
  }

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

    let data: unknown;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text.slice(0, 200) };
      }
    }

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
  // Try Tauri HTTP plugin first — works in production Tauri builds
  // __TAURI__ may not exist in Tauri v2, so try the import directly
  try {
    return await tauriFetch(url, options);
  } catch (tauriError) {
    // If Tauri plugin not available (running in browser), fall back
    if (
      tauriError instanceof TypeError &&
      String(tauriError).includes('Failed to fetch dynamically imported module')
    ) {
      return browserFetch(url, options);
    }
    // Re-throw actual network/API errors
    throw tauriError;
  }
}
