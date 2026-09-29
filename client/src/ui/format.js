/** Formatting helpers + small shared UI atoms. */
import { h } from '../core/h.js';

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtBirth = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');
export const genderLabel = (g) => ({ MALE: 'Male', FEMALE: 'Female' }[g] || '—');

const STATUS_TEXT = {
  NOT_STARTED: 'NOT STARTED',
  DATA_COMPLETED: 'DATA COMPLETED',
  PROGRAM_SELECTED: 'PROGRAM SELECTED',
  SUBMITTED: 'SUBMITTED',
  AVAILABLE: 'AVAILABLE',
  ALMOST_FULL: 'ALMOST FULL',
  FULL: 'FULL',
};
export const statusText = (s) => STATUS_TEXT[s] || s;

export function badge(status) {
  return h('span', { class: `badge badge-${String(status).toLowerCase()}` }, h('i', { class: 'dot' }), statusText(status));
}

/** Holographic quota bar. */
export function quotaBar(applicants, capacity, availability) {
  const pct = capacity ? Math.min(100, (applicants / capacity) * 100) : 100;
  return h('div', { class: `quota-bar quota-${String(availability).toLowerCase()}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': capacity, 'aria-valuenow': applicants, 'aria-label': 'Quota filled' },
    h('div', { class: 'quota-fill', style: { width: `${pct}%` } }));
}

/** Label/value rows used by dashboard, review and admin detail. */
export function infoList(rows) {
  return h('dl', { class: 'info-list' }, rows.map(([k, v]) => h('div', { class: 'info-row' }, h('dt', {}, k), h('dd', {}, v ?? '—'))));
}

export function downloadText(filename, text, type = 'text/html') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
