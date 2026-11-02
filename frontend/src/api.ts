import type { EmailRow, SchedulePayload, SlackStatus, User } from './types';

// Production serves the frontend and API from the same origin. Keep the local
// backend default for Vite development unless an explicit API URL is provided.
export const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:4000' : '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export const api = {
  me: () => request<User>('/auth/me'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  emails: (status: 'scheduled' | 'sent') => request<EmailRow[]>(`/api/emails?status=${status}`),
  schedule: (p: SchedulePayload) => request<{ count: number }>('/api/schedule', { method: 'POST', body: JSON.stringify(p) }),
  slackStatus: () => request<SlackStatus>('/api/slack/status'),
  slackDisconnect: () => request<{ ok: boolean }>('/api/slack', { method: 'DELETE' }),
};

export const googleLoginUrl = `${BASE}/auth/google`;
export const slackConnectUrl = `${BASE}/api/slack/connect`;
