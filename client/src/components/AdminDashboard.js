/** ADMIN DASHBOARD — statistics, applicants by program chart, searchable applicant table, demo tools. */
import { h, mount } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { adminApi } from '../api/services.js';
import { store, loadSnapshot } from '../core/store.js';
import { field, setLoading } from '../ui/form.js';
import { badge, quotaBar } from '../ui/format.js';
import { confirmDialog } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { countTo } from '../ui/effects.js';
import { ApplicantTable } from './ApplicantTable.js';
import { ApplicantsChart } from './ApplicantsChart.js';

export function AdminDashboard(ctx) {
  const query = { q: '', program: '', status: '', page: 1, limit: 15 };
  let overview = null;

  // ----- stat cards -----
  const stat = (label, ic) => {
    const value = h('div', { class: 'stat-value' }, '0');
    const sub = h('div', { class: 'stat-sub' });
    const el = h('div', { class: 'holo-panel stat-card scan', 'data-tilt': '6' }, h('div', { class: 'stat-label' }, icon(ic, 14), label), value, sub);
    return { el, value, sub };
  };
  const stats = {
    applicants: stat('Total Applicants', 'users'),
    programs: stat('Total Programs', 'grid'),
    seats: stat('Available Seats', 'seat'),
    full: stat('Full Programs', 'lock'),
  };

  const chartHost = h('div');
  const programTableHost = h('div', { class: 'table-wrap' });
  const tableHost = h('div');
  const pagerHost = h('div', { class: 'pagination' });
  const dangerHost = h('div');

  // ----- filters -----
  const search = field({ name: 'q', label: 'Search', icon: 'search', placeholder: 'Search name, email, NIK or Registration ID…' });
  const programFilter = field({ name: 'program', label: 'Program', type: 'select', placeholder: 'All programs', options: [] });
  const statusFilter = field({
    name: 'status', label: 'Status', type: 'select', placeholder: 'All statuses',
    options: [['SUBMITTED', 'Submitted'], ['PROGRAM_SELECTED', 'Program selected'], ['DATA_COMPLETED', 'Data completed']],
  });
  let debounce;
  search.input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { query.q = search.input.value; query.page = 1; loadTable(); }, 300); });
  programFilter.input.addEventListener('change', () => { query.program = programFilter.input.value; query.page = 1; loadTable(); });
  statusFilter.input.addEventListener('change', () => { query.status = statusFilter.input.value; query.page = 1; loadTable(); });

  function renderOverview() {
    const { stats: s, programs, byStatus } = overview;
    countTo(stats.applicants.value, s.totalRecords);
    stats.applicants.sub.textContent = `${byStatus.SUBMITTED} submitted · ${byStatus.PROGRAM_SELECTED} reserved · ${byStatus.DATA_COMPLETED} data only`;
    countTo(stats.programs.value, s.totalPrograms);
    stats.programs.sub.textContent = `Total capacity ${s.totalCapacity}`;
    countTo(stats.seats.value, s.availableSeats);
    stats.seats.sub.textContent = `${s.applicants} of ${s.totalCapacity} seats taken`;
    countTo(stats.full.value, s.fullPrograms);
    stats.full.sub.textContent = `Registration ${s.status}`;

    mount(chartHost, ApplicantsChart(programs));
    mount(programTableHost, h('table', { class: 'table program-table' },
      h('thead', {}, h('tr', {}, ['Program', 'Submitted', 'Reserved', 'Seats', 'Remaining', 'Status'].map((t) => h('th', {}, t)))),
      h('tbody', {}, programs.map((p) => h('tr', {},
        h('td', {}, h('b', {}, p.name), h('div', { style: { marginTop: '0.35rem' } }, quotaBar(p.applicants, p.capacity, p.availability))),
        h('td', {}, p.submitted), h('td', {}, p.applicants - p.submitted), h('td', { class: 'mono' }, `${p.applicants}/${p.capacity}`),
        h('td', {}, p.remaining), h('td', {}, badge(p.availability)))))));

    // program filter options (keep current selection)
    const sel = programFilter.input;
    const cur = sel.value;
    mount(sel, h('option', { value: '' }, 'All programs'), programs.map((p) => h('option', { value: p.id, selected: String(p.id) === cur }, p.name)));

    mount(dangerHost, overview.demoMode ? h('div', { class: 'holo-panel danger-zone' },
      h('div', { class: 'panel-title' }, icon('alert', 18), 'Development / Demo Tools'),
      h('p', { class: 'muted' }, 'Visible only because DEMO_MODE is enabled on the server. Disable it in production.'),
      h('div', { class: 'row actions' },
        h('button', { class: 'btn btn-danger', onClick: (e) => reset(e.currentTarget, 'demo') }, icon('refresh', 16), 'Reset Demo Data'),
        h('button', { class: 'btn btn-ghost', onClick: (e) => reset(e.currentTarget, 'dummies') }, icon('trash', 16), 'Remove Dummy Applicants'))) : null);
  }

  async function reset(btn, mode) {
    const ok = await confirmDialog(mode === 'demo'
      ? { title: 'RESET DEMO DATA', message: 'Reset all applicants? Every applicant and applicant account will be deleted and the default demo data restored.', confirmText: 'RESET', danger: true }
      : { title: 'REMOVE DUMMY DATA', message: 'Delete all dummy (demo) applicants? Real registrations are kept.', confirmText: 'REMOVE', danger: true });
    if (!ok) return;
    const restore = setLoading(btn, 'RESETTING');
    try {
      const r = await adminApi.reset(mode);
      toast(mode === 'demo' ? `Demo data restored (${r.dummyApplicants} dummy applicants).` : `${r.removed} dummy applicants removed.`, 'success');
      query.page = 1;
      await Promise.all([loadOverview(), loadTable(), loadSnapshot()]);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      restore();
    }
  }

  async function loadOverview() {
    try {
      overview = await adminApi.overview();
      renderOverview();
    } catch (err) { toast(err.message, 'error'); }
  }

  let tableReq = 0;
  async function loadTable() {
    const id = ++tableReq;
    try {
      const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '' && v !== null));
      const r = await adminApi.applicants(params);
      if (id !== tableReq) return; // a newer request is in flight
      const offset = (r.page - 1) * r.limit;
      mount(tableHost, ApplicantTable({ rows: r.rows, offset }));
      mount(pagerHost,
        h('span', {}, r.total ? `Showing ${offset + 1}–${offset + r.rows.length} of ${r.total} applicants` : '0 applicants'),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-sm btn-ghost', disabled: r.page <= 1, onClick: () => { query.page--; loadTable(); } }, icon('arrowLeft', 14), 'Prev'),
          h('span', { class: 'mono', style: { fontSize: '0.75rem' } }, `${r.page} / ${r.pages}`),
          h('button', { class: 'btn btn-sm btn-ghost', disabled: r.page >= r.pages, onClick: () => { query.page++; loadTable(); } }, 'Next', icon('arrowRight', 14))));
    } catch (err) { toast(err.message, 'error'); }
  }

  // Live refresh: whenever the realtime feed reports a quota change
  let lastSnap = store.get().snapshot;
  let liveTimer;
  ctx.onCleanup(store.subscribe((s) => {
    if (s.snapshot === lastSnap) return;
    lastSnap = s.snapshot;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { loadOverview(); loadTable(); }, 400);
  }));
  ctx.onCleanup(() => clearTimeout(liveTimer));

  loadOverview();
  loadTable();

  return h('div', { class: 'container section' },
    h('div', { class: 'row-between page-head' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Control Center'), h('h2', {}, 'ADMIN DASHBOARD'), h('p', {}, 'Monitor every applicant and the live capacity of each program.')),
      h('div', { class: 'row' },
        h('span', { class: 'live-label' }, h('span', { class: 'live-dot blink' }), 'LIVE'),
        h('button', { class: 'btn btn-sm', onClick: (e) => { const r = setLoading(e.currentTarget, 'SYNC'); Promise.all([loadOverview(), loadTable()]).finally(r); } }, icon('refresh', 14), 'Refresh'))),
    h('div', { class: 'grid-4', style: { marginBottom: '1.25rem' } }, stats.applicants.el, stats.programs.el, stats.seats.el, stats.full.el),
    h('div', { class: 'grid-2', style: { marginBottom: '1.25rem', alignItems: 'start' } },
      h('div', { class: 'holo-panel' }, h('div', { class: 'panel-title' }, icon('chart', 18), 'Applicants by Program'), chartHost),
      h('div', { class: 'holo-panel' }, h('div', { class: 'panel-title' }, icon('grid', 18), 'Program Capacity'), programTableHost)),
    h('div', { class: 'holo-panel', style: { marginBottom: '1.25rem' } },
      h('div', { class: 'panel-title' }, icon('users', 18), 'Applicants'),
      h('div', { class: 'admin-toolbar' }, search, programFilter, statusFilter),
      tableHost, pagerHost),
    dangerHost);
}
