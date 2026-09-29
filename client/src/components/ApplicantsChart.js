/** "Applicants by Program" — futuristic horizontal bar chart (pure CSS, no chart library needed). */
import { h } from '../core/h.js';

export function ApplicantsChart(programs) {
  const rows = programs.map((p) => {
    const cap = Math.max(1, p.capacity);
    const seat = h('div', { class: ['chart-bar', p.availability === 'FULL' && 'full'] });
    const sub = h('div', { class: 'chart-bar submitted' });
    // animate after insertion
    requestAnimationFrame(() => requestAnimationFrame(() => {
      seat.style.width = `${Math.min(100, (p.applicants / cap) * 100)}%`;
      sub.style.width = `${Math.min(100, (p.submitted / cap) * 100)}%`;
    }));
    return h('div', { class: 'chart-row', title: `${p.name}: ${p.submitted} submitted, ${p.applicants - p.submitted} reserved, capacity ${p.capacity}` },
      h('div', { class: 'chart-label' }, p.name),
      h('div', { class: 'chart-track' }, seat, sub),
      h('div', { class: 'chart-value' }, `${p.applicants}/${p.capacity}`));
  });
  return h('div', {},
    h('div', { class: 'chart', role: 'img', 'aria-label': programs.map((p) => `${p.name} ${p.applicants} of ${p.capacity}`).join(', ') }, rows),
    h('div', { class: 'chart-legend' },
      h('span', {}, h('i', { style: { background: 'var(--purple)' } }), 'Submitted'),
      h('span', {}, h('i', { style: { background: 'var(--cyan)' } }), 'Seat reserved (selected, not yet submitted)'),
      h('span', {}, h('i', { style: { background: 'var(--danger)' } }), 'Program full')));
}
