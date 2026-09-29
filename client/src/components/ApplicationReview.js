/** APPLICATION REVIEW — last check before the final, irreversible submission. */
import { h, mount } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { store, setDashboard, loadSnapshot } from '../core/store.js';
import { navigate } from '../core/router.js';
import { applicantApi, programApi } from '../api/services.js';
import { ProgressTracker } from './ProgressTracker.js';
import { infoList, fmtBirth, genderLabel, badge, quotaBar } from '../ui/format.js';
import { confirmDialog } from '../ui/modal.js';
import { setLoading, formAlert } from '../ui/form.js';
import { toast } from '../ui/toast.js';

export function ApplicationReview(ctx) {
  const { dashboard } = store.get();
  const a = dashboard.applicant;
  const programHost = h('div');
  const alert = formAlert();

  const check = h('input', { type: 'checkbox', id: 'confirm-check', onChange: () => { submitBtn.disabled = !check.checked; } });
  const submitBtn = h('button', { class: 'btn btn-primary btn-block', disabled: true, onClick: onSubmit }, icon('check', 18), 'Submit Application');

  /** Program panel uses LIVE numbers from the realtime feed. */
  function renderProgram() {
    const live = store.get().snapshot?.programs.find((p) => p.id === a.selected_program) || store.get().dashboard.program;
    mount(programHost,
      h('div', { class: 'program-icon' }, icon(live.icon, 30)),
      h('div', { class: 'program-code' }, `PROGRAM · ${live.code}`),
      h('h3', { class: 'program-name', style: { fontSize: '1.2rem', margin: '0.2rem 0 1rem' } }, live.name),
      infoList([
        ['Program Studi', live.name],
        ['Jumlah pendaftar', `${live.applicants} / ${live.capacity}`],
        ['Sisa kuota', String(live.remaining)],
        ['Kuota status', badge(live.availability)],
        ['Your seat', h('span', { style: { color: 'var(--ok)' } }, '✓ Reserved for you')],
      ]),
      h('div', { style: { marginTop: '0.75rem' } }, quotaBar(live.applicants, live.capacity, live.availability)));
  }
  ctx.onCleanup(store.subscribe(renderProgram));
  renderProgram();

  async function onSubmit() {
    alert.show('');
    if (!check.checked) return alert.show('Please confirm that the information provided is correct.');
    const ok = await confirmDialog({
      title: 'ARE YOU SURE?',
      message: 'Once submitted, your program selection cannot be changed.',
      confirmText: 'CONFIRM',
      cancelText: 'CANCEL',
    });
    if (!ok) return;
    const restore = setLoading(submitBtn, 'TRANSMITTING');
    try {
      const d = await applicantApi.submit();
      sessionStorage.setItem('nexus.justSubmitted', '1');
      setDashboard(d);
      loadSnapshot().catch(() => {});
      navigate('/success');
    } catch (err) {
      restore();
      alert.show(err.message);
      if (err.code === 'ALREADY_SUBMITTED') navigate('/dashboard');
    }
  }

  async function cancelSelection(e) {
    const ok = await confirmDialog({ title: 'RELEASE SEAT?', message: `Your reserved seat in ${a.program_name} will be given back so other applicants can take it.`, confirmText: 'RELEASE', danger: true });
    if (!ok) return;
    const restore = setLoading(e.currentTarget ?? e.target, 'RELEASING');
    try {
      const d = await programApi.release();
      setDashboard(d);
      toast('Seat released. Choose another program.', 'info');
      navigate('/programs');
    } catch (err) {
      restore();
      toast(err.message, 'error');
    }
  }
  const releaseBtn = h('button', { class: 'btn btn-ghost btn-sm', onClick: (e) => cancelSelection({ currentTarget: e.currentTarget }) }, icon('x', 14), 'Release Seat');

  return h('div', { class: 'container section' },
    ProgressTracker(dashboard.status, { compact: true, currentKey: 'CONFIRM' }),
    h('div', { class: 'page-head' },
      h('div', { class: 'eyebrow' }, 'Step 04 · Confirmation'),
      h('h2', {}, 'APPLICATION REVIEW'),
      h('p', {}, 'Check every detail carefully. After submission your data and program selection are locked.')),
    h('div', { class: 'review-grid' },
      h('div', { class: 'holo-panel scan' },
        h('div', { class: 'row-between' },
          h('div', { class: 'panel-title' }, icon('user', 18), 'Personal Information'),
          h('button', { class: 'btn btn-sm btn-ghost', onClick: () => navigate('/personal') }, icon('edit', 14), 'Edit')),
        infoList([
          ['Nama', a.name], ['NIK', a.nik], ['Tempat lahir', a.birth_place], ['Tanggal lahir', fmtBirth(a.birth_date)],
          ['Jenis kelamin', genderLabel(a.gender)], ['Alamat', `${a.address}, ${a.city}, ${a.province}`],
          ['Nomor HP', a.phone], ['Email', a.email], ['Asal sekolah', a.school], ['Tahun lulus', a.graduation_year],
        ])),
      h('div', { class: 'stack' },
        h('div', { class: 'holo-panel review-program', 'data-tilt': '4' },
          h('div', { class: 'row-between' },
            h('div', { class: 'panel-title' }, icon('grid', 18), 'Program Selection'),
            h('button', { class: 'btn btn-sm btn-ghost', onClick: () => navigate('/programs') }, icon('refresh', 14), 'Change')),
          programHost,
          h('div', { style: { marginTop: '0.75rem' } }, releaseBtn)),
        h('div', { class: 'holo-panel' },
          alert,
          h('label', { class: 'checkbox', for: 'confirm-check', style: { marginTop: alert.hidden ? 0 : '0.75rem' } }, check,
            h('span', {}, 'I confirm that the information provided is correct.')),
          h('div', { class: 'review-actions' }, submitBtn,
            h('button', { class: 'btn btn-ghost btn-block', onClick: () => navigate('/dashboard') }, icon('arrowLeft', 16), 'Back to Dashboard'))))));
}
