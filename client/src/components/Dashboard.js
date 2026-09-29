/** Applicant dashboard: WELCOME, status, progress tracker, next step and application details. */
import { h } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { STATUS } from '/shared/status.js';
import { ProgressTracker } from './ProgressTracker.js';
import { badge, infoList, fmtDateTime, fmtBirth, genderLabel } from '../ui/format.js';
import { downloadReceipt } from './receipt.js';

const NEXT = {
  NOT_STARTED: { title: 'Complete your personal data', text: 'Fill in your identity, contact and education details to unlock program selection.', cta: 'Fill Personal Data', to: '/personal', ic: 'file' },
  DATA_COMPLETED: { title: 'Select your future', text: 'Your data is saved. Choose one study program with an available seat.', cta: 'Select Program', to: '/programs', ic: 'grid' },
  PROGRAM_SELECTED: { title: 'Review & submit', text: 'A seat is reserved for you. Review your application and submit it to receive your Application ID.', cta: 'Review Application', to: '/review', ic: 'check' },
  SUBMITTED: { title: 'Application submitted', text: 'Your application is final. Keep your registration receipt safe.', cta: 'View Success Page', to: '/success', ic: 'sparkles' },
};

export function Dashboard() {
  const { user, dashboard } = store.get();
  const d = dashboard || { status: STATUS.NOT_STARTED };
  const a = d.applicant;
  const status = d.status;
  const next = NEXT[status];
  const submitted = status === STATUS.SUBMITTED;
  const hasData = status !== STATUS.NOT_STARTED;
  const hasProgram = status === STATUS.PROGRAM_SELECTED || submitted;

  const side = (label, ic, to, enabled = true, active = false) => h('button', {
    class: ['side-link', active && 'active', !enabled && 'locked'], disabled: !enabled,
    title: enabled ? label : 'Complete the previous step first', onClick: () => navigate(to),
  }, icon(ic, 16), label, !enabled ? icon('lock', 14, 'lock') : null);

  const receiptBtn = h('button', { class: 'btn btn-sm', onClick: (e) => downloadReceipt(e.currentTarget, a?.registration_number) }, icon('download', 16), 'Download Receipt');

  return h('div', { class: 'container dash-layout' },
    h('aside', { class: 'holo-panel sidebar', 'aria-label': 'Application menu' },
      side('Overview', 'chart', '/dashboard', true, true),
      side('Personal Data', 'file', '/personal', !submitted),
      side('Programs', 'grid', '/programs', true),
      side('Review & Submit', 'check', '/review', hasProgram && !submitted),
      side('Result', 'sparkles', '/success', submitted)),

    h('div', { class: 'dash-main' },
      h('div', { class: 'holo-panel welcome scan reveal' },
        h('div', {},
          h('div', { class: 'eyebrow' }, 'Applicant Console'),
          h('h1', {}, 'WELCOME, ', h('span', { class: 'grad-text' }, (user.name || '').toUpperCase()))),
        h('div', { class: 'status-big' }, h('div', { class: 'label' }, 'APPLICATION STATUS'), badge(status))),

      h('div', { class: 'reveal', style: { '--i': 1 } }, ProgressTracker(status)),

      h('div', { class: 'holo-panel next-step reveal', style: { '--i': 2 }, 'data-tilt': '3' },
        h('div', { class: 'row', style: { flexWrap: 'nowrap', alignItems: 'flex-start' } },
          h('div', { class: 'program-icon', style: { flex: 'none' } }, icon(next.ic, 26)),
          h('div', {}, h('div', { class: 'eyebrow', style: { marginBottom: '0.3rem' } }, 'Next Step'), h('h3', {}, next.title), h('p', {}, next.text))),
        h('div', { class: 'row actions' },
          submitted ? receiptBtn : null,
          h('button', { class: 'btn btn-primary', onClick: () => navigate(next.to) }, next.cta, icon('arrowRight', 16)))),

      h('div', { class: 'grid-2' },
        h('div', { class: 'holo-panel reveal', style: { '--i': 3 } },
          h('div', { class: 'panel-title' }, icon('user', 18), 'Account'),
          infoList([['Nama', user.name], ['Email', user.email], ['Member since', fmtDateTime(user.created_at)]])),
        h('div', { class: 'holo-panel reveal', style: { '--i': 4 } },
          h('div', { class: 'panel-title' }, icon('file', 18), 'Application'),
          infoList([
            ['Status', badge(status)],
            ['Program Studi', a?.program_name || (hasData ? 'Not selected yet' : '—')],
            ['Nomor Pendaftaran', a?.registration_number ? h('span', { class: 'reg-number', style: { fontSize: '1rem' } }, a.registration_number) : '— (issued after submission)'],
            ['Waktu Pendaftaran', submitted ? fmtDateTime(a.registration_date) : '—'],
            ...(submitted ? [['Email notification', emailStatusText(a.email_status)]] : []),
          ]))),

      hasData ? h('div', { class: 'holo-panel reveal', style: { '--i': 5 } },
        h('div', { class: 'row-between' },
          h('div', { class: 'panel-title' }, icon('file', 18), 'Personal Data'),
          !submitted ? h('button', { class: 'btn btn-sm btn-ghost', onClick: () => navigate('/personal') }, icon('edit', 14), 'Edit') : h('span', { class: 'row muted' }, icon('lock', 14), 'Locked')),
        h('div', { class: 'grid-2' },
          infoList([['NIK', a.nik], ['Tempat / Tgl Lahir', `${a.birth_place}, ${fmtBirth(a.birth_date)}`], ['Jenis Kelamin', genderLabel(a.gender)], ['Asal Sekolah', `${a.school} (${a.graduation_year})`]]),
          infoList([['Alamat', a.address], ['Kota / Provinsi', `${a.city}, ${a.province}`], ['Nomor HP', a.phone], ['Email', a.email]]))) : null));
}

export function emailStatusText(s) {
  if (s === 'SENT') return '✓ Confirmation email sent';
  if (s === 'FAILED') return '⚠ Email could not be sent (application is still valid)';
  return 'Not sent — email service is not configured on the server';
}
