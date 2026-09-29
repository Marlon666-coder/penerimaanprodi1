/** SELECT YOUR FUTURE — live program list with quota (updates in realtime via SSE). */
import { h, mount } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { store, setDashboard, loadSnapshot } from '../core/store.js';
import { navigate } from '../core/router.js';
import { programApi } from '../api/services.js';
import { STATUS } from '/shared/status.js';
import { ProgramCard } from './ProgramCard.js';
import { ProgressTracker } from './ProgressTracker.js';
import { confirmDialog } from '../ui/modal.js';
import { setLoading } from '../ui/form.js';
import { toast } from '../ui/toast.js';

const FILTERS = [['ALL', 'All'], ['AVAILABLE', 'Available'], ['ALMOST_FULL', 'Almost Full'], ['FULL', 'Full']];

export function ProgramList(ctx) {
  let filter = 'ALL';
  let busy = false;
  const grid = h('div', { class: 'programs-grid', 'aria-live': 'polite' });
  const noticeHost = h('div');
  const chips = h('div', { class: 'filter-bar', role: 'group', 'aria-label': 'Filter programs' });
  const trackerHost = h('div');
  let rendered = false;

  function viewer() {
    const { user, dashboard } = store.get();
    if (!user) return { role: 'guest' };
    if (user.role === 'admin') return { role: 'admin' };
    return { role: 'applicant', status: dashboard?.status ?? STATUS.NOT_STARTED, selectedId: dashboard?.applicant?.selected_program ?? null };
  }

  /**
   * QUOTA — select flow. The browser only asks; the server decides.
   * If the program became full meanwhile, the server answers PROGRAM_FULL.
   */
  async function onSelect(p, btn) {
    if (busy) return;
    const v = viewer();
    const current = store.get().dashboard?.program;
    const ok = await confirmDialog({
      title: v.selectedId ? 'SWITCH PROGRAM?' : 'SELECT PROGRAM?',
      message: v.selectedId
        ? `Your seat in ${current?.name} will be released and a seat in ${p.name} will be reserved for you.`
        : `Reserve a seat in ${p.name}? (${p.applicants}/${p.capacity} taken). You can still change it until you submit.`,
      confirmText: 'RESERVE SEAT',
    });
    if (!ok) return;
    busy = true;
    const restore = setLoading(btn, 'RESERVING');
    try {
      const d = await programApi.select(p.id);
      setDashboard(d);
      toast(`Seat reserved in ${p.name} (${d.program.applicants}/${d.program.capacity}).`, 'success');
      loadSnapshot().catch(() => {});
      navigate('/review');
    } catch (err) {
      restore();
      toast(err.message, 'error', 6000);
      loadSnapshot().catch(() => {}); // refresh numbers after a rejection
    } finally {
      busy = false;
    }
  }

  function renderNotice(v) {
    const { dashboard } = store.get();
    let n = null;
    if (v.role === 'guest') {
      n = ['info', 'You are exploring as a guest. Sign in or register to select a program.', h('div', { class: 'row' },
        h('a', { class: 'btn btn-sm', href: '#/login' }, 'Sign In'), h('a', { class: 'btn btn-sm btn-primary', href: '#/register' }, 'Register'))];
    } else if (v.role === 'admin') {
      n = ['info', 'Admin view — program selection is only available for applicant accounts.', h('a', { class: 'btn btn-sm btn-purple', href: '#/admin' }, 'Admin Dashboard')];
    } else if (v.status === STATUS.NOT_STARTED) {
      n = ['warn', 'Complete your personal data before selecting a program.', h('a', { class: 'btn btn-sm btn-primary', href: '#/personal' }, 'Fill Personal Data')];
    } else if (v.status === STATUS.PROGRAM_SELECTED) {
      n = ['info', `Your seat is reserved in ${dashboard.program?.name}. Review and submit to finalise it.`, h('a', { class: 'btn btn-sm btn-primary', href: '#/review' }, 'Review & Submit')];
    } else if (v.status === STATUS.SUBMITTED) {
      n = ['success', `Application submitted for ${dashboard.program?.name}. Selection is locked.`, h('a', { class: 'btn btn-sm', href: '#/dashboard' }, 'Dashboard')];
    }
    mount(noticeHost, n ? h('div', { class: `form-alert form-alert-${n[0]} notice` }, h('span', { class: 'row' }, icon(n[0] === 'warn' ? 'alert' : 'radio', 18), n[1]), n[2]) : null);
    mount(trackerHost, v.role === 'applicant' ? ProgressTracker(v.status, { compact: true, currentKey: v.status === STATUS.SUBMITTED ? undefined : v.status === STATUS.NOT_STARTED ? 'PERSONAL' : 'PROGRAM' }) : null);
  }

  function render() {
    const snap = store.get().snapshot;
    const v = viewer();
    renderNotice(v);
    mount(chips, FILTERS.map(([k, label]) => {
      const count = snap ? (k === 'ALL' ? snap.programs.length : snap.programs.filter((p) => p.availability === k).length) : 0;
      return h('button', { class: ['chip', filter === k && 'active'], 'aria-pressed': String(filter === k), onClick: () => { filter = k; render(); } }, `${label} (${count})`);
    }));
    if (!snap) return mount(grid, h('p', { class: 'muted' }, 'Loading programs…'));
    const list = snap.programs.filter((p) => filter === 'ALL' || p.availability === filter);
    const animate = !rendered;
    rendered = true;
    mount(grid, list.length
      ? list.map((p, i) => ProgramCard(p, v, { onSelect, onNavigate: navigate }, { animate, index: i }))
      : h('p', { class: 'muted' }, 'No programs match this filter.'));
  }

  // Re-render when live quota data or the user's application changes
  let last = null;
  ctx.onCleanup(store.subscribe((s) => {
    if (busy) return;
    if (s.snapshot === last?.snapshot && s.dashboard === last?.dashboard && s.user === last?.user) return;
    last = { snapshot: s.snapshot, dashboard: s.dashboard, user: s.user };
    render();
  }));
  render();

  return h('div', { class: 'container section' },
    trackerHost,
    h('div', { class: 'row-between page-head' },
      h('div', {},
        h('div', { class: 'eyebrow' }, 'Step 03 · Program Selection'),
        h('h2', {}, 'SELECT YOUR ', h('span', { class: 'grad-text' }, 'FUTURE')),
        h('p', {}, 'Each program accepts a maximum number of students. Seats update in realtime — once a program is FULL it is closed automatically.')),
      h('span', { class: 'live-label' }, h('span', { class: 'live-dot blink' }), 'LIVE QUOTA')),
    noticeHost,
    chips,
    grid);
}
