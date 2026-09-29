/**
 * Low-level API client with an automatic STATIC-MODE fallback.
 *
 * - When the Node server IS present, requests hit the real REST API.
 * - When the app is served by a static host that has no backend
 *   (e.g. GitHub Pages), there is no /api/* server. We detect that once and
 *   route every request to the in-browser localStorage backend instead, which
 *   implements the same endpoints. This is what keeps the deployed site
 *   working (and looking correct) on GitHub Pages.
 *
 * Detection: on the first API call we ping /api/health. If it does not answer
 * with JSON (404 HTML from the static host, or a network error), we switch to
 * static mode for the rest of the session.
 */
const TOKEN_KEY = 'nexus.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields || {};
  }
}

const unauthorizedListeners = new Set();
export const onUnauthorized = (fn) => unauthorizedListeners.add(fn);

// ---------- static-mode detection ----------
let mode = null; // 'server' | 'static'
let localModule = null;
export const isStaticMode = () => mode === 'static';

async function loadLocal() {
  if (!localModule) localModule = await import('./localBackend.js');
  return localModule;
}

async function detectMode() {
  if (mode) return mode;
  try {
    const res = await fetch('/api/health', { headers: { Accept: 'application/json' } });
    const type = res.headers.get('content-type') || '';
    mode = res.ok && type.includes('application/json') ? 'server' : 'static';
  } catch {
    mode = 'static';
  }
  if (mode === 'static') {
    await loadLocal();
    console.info('[NEXUS] No backend detected — running in static mode (data stored in your browser).');
  }
  return mode;
}

/** Turn a thrown LocalError from the static backend into an ApiError. */
function toApiError(err) {
  const e = new ApiError(err.status || 500, err.code || 'ERROR', err.message || 'Request failed', err.fields);
  if (e.status === 401) unauthorizedListeners.forEach((fn) => fn());
  return e;
}

export async function request(path, { method = 'GET', body, raw = false } = {}) {
  await detectMode();
  const token = tokenStore.get();

  if (mode === 'static') {
    const local = await loadLocal();
    let data;
    try {
      data = await local.handleLocal(path, { method, body, token });
    } catch (err) {
      throw toApiError(err);
    }
    // `raw` is used for the HTML receipt; mimic a Response with .text()
    if (raw) return { ok: true, text: async () => data.__html };
    return data;
  }

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the NEXUS server. Check your connection.');
  }
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error || {};
    if (res.status === 401 && token) unauthorizedListeners.forEach((fn) => fn());
    throw new ApiError(res.status, e.code || 'ERROR', e.message || `Request failed (${res.status})`, e.fields);
  }
  return data;
}
