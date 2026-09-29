/**
 * NEXUS ADMISSION — frontend entry point.
 * 1. Boot animation while the session and live quota data load
 * 2. Start visual effects
 * 3. Start the SPA router
 */
import { initRouter } from './core/router.js';
import { store, restoreSession, loadSnapshot, startRealtime } from './core/store.js';
import { routes } from './routes.js';
import { Navbar } from './components/Navbar.js';
import { startParticles, startCursorGlow, startTilt } from './ui/effects.js';
import { toast } from './ui/toast.js';

document.getElementById('year').textContent = new Date().getFullYear();

async function boot() {
  const lines = document.getElementById('boot-lines');
  const bar = document.getElementById('boot-bar');
  const firstVisit = !sessionStorage.getItem('nexus.booted');
  const wait = (ms) => new Promise((r) => setTimeout(r, firstVisit ? ms : 0));
  const line = (text, cls) => { const d = document.createElement('div'); d.textContent = text; if (cls) d.className = cls; lines.append(d); };

  line('INITIALIZING NEXUS...');
  bar.style.width = '25%';
  const dataReady = Promise.allSettled([restoreSession(), loadSnapshot()]);
  await wait(550);
  line('LOADING APPLICATION SYSTEM...');
  bar.style.width = '65%';
  const [, snap] = await dataReady;
  await wait(450);
  bar.style.width = '100%';
  line('SYSTEM READY', 'ready');
  await wait(400);
  sessionStorage.setItem('nexus.booted', '1');
  document.getElementById('boot').classList.add('done');
  if (snap.status === 'rejected') toast('Could not load live quota data. Retrying in the background…', 'error');
}

startParticles(document.getElementById('particles'));
startCursorGlow(document.getElementById('cursor-glow'));
startTilt();
// Entry animations use `fill-mode: both`; remove the class afterwards so hover/tilt transforms work
document.addEventListener('animationend', (e) => {
  if (e.target.classList?.contains('reveal') && e.animationName === 'page-in') e.target.classList.remove('reveal');
  if (e.target.classList?.contains('page-enter') && e.animationName === 'page-in') e.target.classList.remove('page-enter');
});

await boot();

const nav = Navbar(document.getElementById('app-nav'));
initRouter({ routes, outlet: document.getElementById('app-view'), onRouteChange: (path) => nav.update(path) });
store.subscribe(() => nav.update());
startRealtime();
