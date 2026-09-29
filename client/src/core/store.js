/**
 * Global app state (a very small observable store).
 *   store.get()             -> current state
 *   store.set({ ... })      -> merge + notify subscribers
 *   store.subscribe(fn)     -> returns unsubscribe
 */
import { authApi, applicantApi, programApi, systemApi, subscribeSnapshot } from '../api/services.js';
import { tokenStore, onUnauthorized } from '../api/client.js';

const state = {
  user: null, // { id, name, email, role }
  dashboard: null, // { applicant, program, status, completedSteps }
  snapshot: null, // { programs, stats } live quota data
  config: { demoMode: false, emailConfigured: false }, // public server settings
};
const listeners = new Set();

export const store = {
  get: () => state,
  set(patch) {
    Object.assign(state, patch);
    listeners.forEach((fn) => fn(state));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// ---------- session actions ----------
export async function restoreSession() {
  if (!tokenStore.get()) return null;
  try {
    const { user } = await authApi.me();
    store.set({ user });
    if (user.role === 'applicant') await refreshDashboard();
    return user;
  } catch {
    tokenStore.clear();
    store.set({ user: null, dashboard: null });
    return null;
  }
}

export async function login(email, password) {
  const { token, user } = await authApi.login(email, password);
  tokenStore.set(token);
  store.set({ user });
  if (user.role === 'applicant') await refreshDashboard();
  return user;
}

export async function registerAccount(data) {
  const { token, user } = await authApi.register(data);
  tokenStore.set(token);
  store.set({ user });
  await refreshDashboard();
  return user;
}

export function logout() {
  tokenStore.clear();
  store.set({ user: null, dashboard: null });
}

export async function refreshDashboard() {
  const dashboard = await applicantApi.dashboard();
  store.set({ dashboard });
  return dashboard;
}

/** Apply a dashboard payload returned by a mutation (select / save / submit). */
export const setDashboard = (dashboard) => store.set({ dashboard });

// ---------- live quota ----------
export async function loadSnapshot() {
  const [{ programs }, stats, config] = await Promise.all([programApi.list(), programApi.stats(), systemApi.config()]);
  store.set({ snapshot: { programs, stats }, config });
}

let stopStream = null;
export function startRealtime() {
  if (stopStream) return;
  stopStream = subscribeSnapshot((snap) => store.set({ snapshot: { programs: snap.programs, stats: snap.stats } }));
}

onUnauthorized(() => {
  logout();
  // lazy import to avoid a circular dependency
  import('./router.js').then(({ navigate }) => navigate('/login', { replace: true }));
});
