/**
 * Hash router (#/login, #/dashboard ...) — SPA navigation without page reloads.
 * Each route: { path, title, auth: 'guest'|'applicant'|'admin'|undefined, guard?(state), render(ctx) }
 *   guard(state) may return { to, message } to redirect (flow rules, e.g. "fill personal data first").
 *   render(ctx) returns a DOM node. ctx.onCleanup(fn) registers teardown (timers, subscriptions).
 */
import { store } from './store.js';
import { toast } from '../ui/toast.js';

let routes = [];
let outlet = null;
let cleanups = [];
let onChange = () => {};
let renderId = 0;

export function initRouter({ routes: r, outlet: o, onRouteChange }) {
  routes = r;
  outlet = o;
  onChange = onRouteChange || onChange;
  window.addEventListener('hashchange', render);
  render();
}

export const currentPath = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];

export function navigate(path, { replace = false } = {}) {
  if (currentPath() === path) return render();
  if (replace) location.replace(`#${path}`);
  else location.hash = path;
}

function resolve(path) {
  const state = store.get();
  const route = routes.find((r) => r.path === path) || routes.find((r) => r.path === '*');
  const user = state.user;
  if (route.auth === 'guest' && user) return { redirect: user.role === 'admin' ? '/admin' : '/dashboard' };
  if (route.auth === 'applicant' || route.auth === 'admin') {
    if (!user) return { redirect: '/login', message: 'Please sign in to continue.' };
    if (route.auth !== user.role) return { redirect: user.role === 'admin' ? '/admin' : '/dashboard', message: 'That page is not available for your account.' };
  }
  const g = route.guard?.(state);
  if (g) return { redirect: g.to, message: g.message };
  return { route };
}

async function render() {
  const id = ++renderId;
  const path = currentPath();
  const { route, redirect, message } = resolve(path);
  if (redirect) {
    if (message) toast(message, 'warn');
    return navigate(redirect, { replace: true });
  }

  // teardown previous page
  cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  cleanups = [];

  const old = outlet.firstElementChild;
  if (old && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    old.classList.add('page-leave');
    await new Promise((r) => setTimeout(r, 180));
    if (id !== renderId) return; // a newer navigation started
  }

  const ctx = { path, onCleanup: (fn) => cleanups.push(fn) };
  const page = route.render(ctx);
  page.classList.add('page', 'page-enter');
  outlet.replaceChildren(page);
  document.title = `${route.title ? `${route.title} · ` : ''}NEXUS ADMISSION`;
  window.scrollTo({ top: 0, behavior: 'instant' });
  outlet.focus({ preventScroll: true });
  onChange(path, route);
}

/** Re-run the current route (e.g. after login state changes). */
export const refreshRoute = () => render();
