/**
 * Holographic program card.
 * The button state follows the QUOTA RULE:
 *   applicants >= capacity  ->  FULL  ->  button "CLOSED" (disabled)
 *   otherwise               ->  AVAILABLE / ALMOST FULL -> "SELECT"
 * (The server re-checks the quota on every selection — see applicationService.selectProgram.)
 */
import { h } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { badge, quotaBar } from '../ui/format.js';
import { STATUS } from '/shared/status.js';

/**
 * @param {object} p program with live counts
 * @param {object} viewer { role: 'guest'|'admin'|'applicant', status, selectedId }
 * @param {object} actions { onSelect(p), onNavigate(path) }
 */
export function ProgramCard(p, viewer, actions, { animate = false, index = 0 } = {}) {
  const isFull = p.availability === 'FULL';
  const isSelected = viewer.selectedId === p.id;
  const submitted = viewer.status === STATUS.SUBMITTED;

  let button;
  if (isSelected && submitted) {
    button = h('button', { class: 'btn btn-purple btn-block', onClick: () => actions.onNavigate('/success') }, icon('check', 16), 'Your Program');
  } else if (isSelected) {
    button = h('button', { class: 'btn btn-purple btn-block', onClick: () => actions.onNavigate('/review') }, icon('check', 16), 'Selected · Review');
  } else if (isFull) {
    button = h('button', { class: 'btn btn-closed btn-block', disabled: true, 'aria-disabled': 'true' }, icon('lock', 16), 'Closed');
  } else if (viewer.role === 'guest') {
    button = h('button', { class: 'btn btn-block', onClick: () => actions.onNavigate('/login') }, icon('login', 16), 'Sign In to Select');
  } else if (viewer.role === 'admin') {
    button = null; // admins observe only
  } else if (submitted) {
    button = h('button', { class: 'btn btn-ghost btn-block', disabled: true, title: 'Your application is already submitted' }, icon('lock', 16), 'Locked');
  } else if (viewer.status === STATUS.NOT_STARTED) {
    button = h('button', { class: 'btn btn-ghost btn-block', onClick: () => actions.onNavigate('/personal'), title: 'Complete your personal data first' }, icon('lock', 16), 'Complete Data First');
  } else {
    button = h('button', { class: 'btn btn-primary btn-block', onClick: (e) => actions.onSelect(p, e.currentTarget) },
      viewer.selectedId ? 'Switch to This' : 'Select', icon('arrowRight', 16));
  }

  return h('article', {
    class: ['holo-panel program-card', animate && 'reveal', isFull && 'is-full', isSelected && 'is-selected'],
    style: { '--i': index }, 'data-tilt': '5', 'aria-label': p.name,
  },
    h('div', { class: 'program-top' },
      h('div', { class: 'program-icon' }, icon(p.icon, 28)),
      h('div', { style: { display: 'grid', justifyItems: 'end', gap: '0.4rem' } },
        badge(p.availability),
        isSelected ? h('span', { class: 'badge badge-program_selected' }, h('i', { class: 'dot' }), submitted ? 'SUBMITTED' : 'YOUR SEAT') : null)),
    h('div', {},
      h('div', { class: 'program-code' }, `PROGRAM · ${p.code}`),
      h('h3', { class: 'program-name' }, p.name)),
    h('p', { class: 'program-desc' }, p.description),
    h('div', {},
      h('div', { class: 'quota-numbers' },
        h('span', {}, 'Kuota ', h('b', {}, p.applicants), ` / ${p.capacity}`),
        h('span', {}, `${Math.round((p.applicants / Math.max(1, p.capacity)) * 100)}%`)),
      h('div', { style: { marginTop: '0.45rem' } }, quotaBar(p.applicants, p.capacity, p.availability)),
      h('div', { class: 'quota-meta' },
        h('span', {}, `Pendaftar: ${p.applicants}`),
        h('span', {}, isFull ? 'No seats left' : `Sisa kuota: ${p.remaining}`))),
    button ? h('div', { class: 'program-actions' }, button) : null);
}
