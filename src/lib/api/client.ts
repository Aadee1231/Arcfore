import { config } from '@/lib/config';
import { getDeviceId } from '@/lib/device';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

let tokenGetter: (() => Promise<string | null>) | null = null;

/** Called once by the auth layer so API requests can carry the Clerk session
 * JWT when the user is signed in (optional — the app works without it). */
export function registerApiTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = await tokenGetter?.().catch(() => null);
  if (token) headers.Authorization = `Bearer ${token}`;
  headers['x-device-id'] = await getDeviceId();
  if (config.apiToken) headers['x-arcfore-key'] = config.apiToken;
  return headers;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const url = `${config.apiUrl}${path}`;
  const timeoutMs = init?.timeoutMs ?? 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...(await authHeaders()), ...(init?.headers as Record<string, string>) },
      signal: controller.signal,
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new ApiError(res.status, body?.message ?? body?.error ?? `Request failed (${res.status})`, body);
    }
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiError(408, 'Request timed out');
    throw new ApiError(0, 'Network error — check your connection');
  } finally {
    clearTimeout(timer);
  }
}

export function apiGet<T>(path: string) {
  return apiFetch<T>(path);
}
export function apiPost<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
}
export function apiUpload<T>(path: string, form: FormData, timeoutMs = 240000) {
  return apiFetch<T>(path, { method: 'POST', body: form, timeoutMs });
}
