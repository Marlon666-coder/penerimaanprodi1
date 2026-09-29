/** Applicant table: No | Registration ID | Name | Email | Program | Status | Date (+ detail modal). */
import { h } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { badge, fmtDateTime, fmtBirth, genderLabel, infoList } from '../ui/format.js';
import { openModal } from '../ui/modal.js';
import { adminApi } from '../api/services.js';
import { toast } from '../ui/toast.js';

export function ApplicantTable({ rows, offset }) {
  const body = rows.length
    ? rows.map((r, i) => h('tr', {
      tabindex: 0, 'aria-label': `View details of ${r.name}`,
      onClick: () => showApplicantDetail(r.id),
      onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showApplicantDetail(r.id); } },
    },
      h('td', {}, offset + i + 1),
      h('td', { class: 'mono' }, r.registration_number || '—'),
      h('td', {}, r.name, r.is_dummy ? h('span', { class: 'tag-dummy', title: 'Demo data' }, 'DEMO') : null),
      h('td', {}, r.email),
      h('td', {}, r.program_name || h('span', { class: 'muted' }, 'Not selected')),
      h('td', {}, badge(r.status)),
      h('td', {}, fmtDateTime(r.registration_date || r.updated_at)),
      h('td', {}, h('button', { class: 'icon-btn', 'aria-label': 'Details', onClick: (e) => { e.stopPropagation(); showApplicantDetail(r.id); } }, icon('eye', 16)))))
    : [h('tr', {}, h('td', { class: 'table-empty', colspan: 8 }, 'No applicants match your filters.'))];

  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['No', 'Registration ID', 'Name', 'Email', 'Program', 'Status', 'Date', ''].map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, body)));
}

export async function showApplicantDetail(id) {
  try {
    const a = await adminApi.applicant(id);
    openModal({
      title: 'APPLICANT DETAIL',
      wide: true,
      content: h('div', {},
        h('div', { class: 'row-between', style: { marginBottom: '1rem' } },
          h('div', {}, h('div', { class: 'reg-number' }, a.registration_number || 'NOT SUBMITTED'), h('div', { class: 'muted' }, `Record #${a.id}${a.is_dummy ? ' · demo data' : ''}`)),
          badge(a.status)),
        h('div', { class: 'grid-2' },
          infoList([['Name', a.name], ['NIK', a.nik], ['Birth', `${a.birth_place}, ${fmtBirth(a.birth_date)}`], ['Gender', genderLabel(a.gender)], ['School', `${a.school} (${a.graduation_year})`]]),
          infoList([['Email', a.email], ['Phone', a.phone], ['Address', `${a.address}, ${a.city}, ${a.province}`], ['Program', a.program_name || '—'],
            ['Registered', fmtDateTime(a.registration_date)], ['Email notif.', a.email_status || '—']]))),
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}
