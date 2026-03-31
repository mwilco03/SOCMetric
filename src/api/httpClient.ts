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

async function parseResponse(response: Response): Promise<{ data: unknown; headers: Record<string, string> }> {
  let data: unknown;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 500) };
    }
  }
  return { data, headers: Object.fromEntries(response.headers.entries()) };
}

async function tauriFetch(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
  const { fetch } = await import('@tauri-apps/plugin-http');

  // Method A: pass body as string with explicit headers
  const responseA = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body || undefined,
  });

  const resultA = await parseResponse(responseA);
  if (responseA.status !== 400 || !options.body) {
    return { status: responseA.status, ...resultA };
  }

  // Method A got 400 on a POST with body — retry with Blob/Request
  const reqInit: RequestInit = {
    method: options.method || 'GET',
    headers: options.headers || {},
  };
  if (options.body) {
    reqInit.body = new Blob([options.body], { type: 'application/json' });
  }
  const request = new Request(url, reqInit);
  const responseB = await fetch(request);
  const resultB = await parseResponse(responseB);

  if (responseB.status === 400) {
    // Both methods failed — return Method B's error with detail about both attempts
    const bodyA = resultA.data as Record<string, unknown> | null;
    const bodyB = resultB.data as Record<string, unknown> | null;
    return {
      status: 400,
      data: {
        errorMessages: [
          `Both request methods returned 400.`,
          `Method A (string body): ${JSON.stringify(bodyA).slice(0, 300)}`,
          `Method B (Blob body): ${JSON.stringify(bodyB).slice(0, 300)}`,
        ],
      },
      headers: resultB.headers,
    };
  }

  return { status: responseB.status, ...resultB };
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
      tauriError instanceof TypeError &&
      String(tauriError).includes('Failed to fetch dynamically imported module')
    ) {
      return browserFetch(url, options);
    }
    throw tauriError;
  }
}
