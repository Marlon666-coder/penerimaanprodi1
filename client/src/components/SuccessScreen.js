/** APPLICATION SUCCESSFUL — holographic ring, glowing checkmark, particle burst, scanning effect. */
import { h, svg } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { infoList, fmtDate, badge } from '../ui/format.js';
import { particleBurst } from '../ui/effects.js';
import { downloadReceipt } from './receipt.js';
import { emailStatusText } from './Dashboard.js';

export function SuccessScreen() {
  const { dashboard } = store.get();
  const a = dashboard.applicant;
  const justSubmitted = sessionStorage.getItem('nexus.justSubmitted') === '1';
  sessionStorage.removeItem('nexus.justSubmitted');

  const rings = h('div', { class: 'holo-rings success-rings' },
    h('div', { class: 'ring' }), h('div', { class: 'ring r2' }), h('div', { class: 'ring r3' }),
    h('div', { class: 'holo-core' }, svg('<svg class="check-svg" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>')));

  // particle explosion once the page is visible
  setTimeout(() => particleBurst(rings, justSubmitted ? 140 : 60), 450);

  const downloadBtn = h('button', { class: 'btn', onClick: (e) => downloadReceipt(e.currentTarget, a.registration_number) }, icon('download', 18), 'Download Registration Receipt');

  return h('section', { class: 'container success-wrap' },
    h('div', { class: 'holo-panel success-card scan' },
      rings,
      h('div', { class: 'eyebrow' }, 'Transmission Complete'),
      h('h1', { class: 'success-title' }, 'APPLICATION SUCCESSFUL'),
      h('p', { class: 'muted' }, 'Your application has been successfully submitted.'),
      h('div', { class: 'app-id' },
        h('div', { class: 'label' }, 'APPLICATION ID'),
        h('div', { class: 'reg-number' }, a.registration_number)),
      infoList([
        ['Nama', a.name],
        ['Program', a.program_name],
        ['Status', badge(a.status)],
        ['Tanggal', fmtDate(a.registration_date)],
        ['Email', emailStatusText(a.email_status)],
      ]),
      h('div', { class: 'success-actions' },
        h('button', { class: 'btn btn-primary', onClick: () => navigate('/dashboard') }, icon('eye', 18), 'View Application'),
        downloadBtn)));
}
