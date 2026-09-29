/**
 * DATA SERVICE LAYER
 * ------------------
 * Every component talks to the backend ONLY through these functions.
 * To switch to Supabase / Firebase / another backend, re-implement these
 * functions (same names, same return shapes) — the UI stays untouched.
 */
import { request, isStaticMode } from './client.js';

export const authApi = {
  register: (data) => request('/api/auth/register', { method: 'POST', body: data }),
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me'),
  forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (data) => request('/api/auth/reset-password', { method: 'POST', body: data }),
};

export const systemApi = {
  config: () => request('/api/config'),
};

export const programApi = {
  list: () => request('/api/programs'),
  stats: () => request('/api/stats'),
  /** QUOTA: the server decides if a seat is still free — never the browser. */
  select: (programId) => request('/api/programs/select', { method: 'POST', body: { programId } }),
  release: () => request('/api/programs/release', { method: 'POST', body: {} }),
};

export const applicantApi = {
  dashboard: () => request('/api/dashboard'),
  savePersonal: (data) => request('/api/applicants', { method: 'POST', body: data }),
  submit: () => request('/api/applications/submit', { method: 'POST', body: { confirm: true } }),
  receipt: async () => (await request('/api/applications/receipt', { raw: true })).text(),
};

export const adminApi = {
  overview: () => request('/api/admin/overview'),
  applicants: (params) => request(`/api/applicants?${new URLSearchParams(params)}`),
  applicant: (id) => request(`/api/applicants/${id}`),
  reset: (mode) => request('/api/admin/reset', { method: 'POST', body: { mode } }),
};

/**
 * Realtime quota feed. Calls `onSnapshot({programs, stats})` whenever any seat
 * changes, and returns an unsubscribe function.
 *  - server mode: Server-Sent Events (/api/stream)
 *  - static mode: in-browser events from the localStorage backend (also syncs
 *    across tabs via the storage event)
 */
export function subscribeSnapshot(onSnapshot) {
  if (isStaticMode()) {
    let stop = () => {};
    import('./localBackend.js').then((m) => { stop = m.subscribeLocal(onSnapshot); });
    return () => stop();
  }
  const es = new EventSource('/api/stream');
  es.addEventListener('snapshot', (e) => {
    try { onSnapshot(JSON.parse(e.data)); } catch { /* ignore malformed */ }
  });
  return () => es.close();
}
