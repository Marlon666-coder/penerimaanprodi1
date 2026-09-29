/**
 * Progress tracker: 01 ACCOUNT → 02 PERSONAL DATA → 03 PROGRAM → 04 CONFIRMATION → 05 SUBMITTED
 * ✓ = done, ● = current, ○ = upcoming
 * @param {string} status application status
 * @param {object} opts { compact: boolean, currentKey?: override the current step }
 */
import { h } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { STEPS, completedSteps } from '/shared/status.js';

export function ProgressTracker(status, { compact = false, currentKey } = {}) {
  const done = completedSteps(status);
  let currentIndex = done < STEPS.length ? done : -1;
  if (currentKey) currentIndex = STEPS.findIndex((s) => s.key === currentKey);
  const pct = Math.round((done / STEPS.length) * 100);

  return h('div', { class: ['holo-panel', compact && 'tracker-compact'] },
    !compact ? h('div', { class: 'row-between' },
      h('div', { class: 'panel-title', style: { margin: 0 } }, icon('radio', 18), 'Application Progress'),
      h('span', { class: 'mono muted', style: { fontSize: '0.75rem' } }, `${pct}% COMPLETE`)) : null,
    h('ol', { class: 'tracker', style: { listStyle: 'none', margin: compact ? 0 : '1.25rem 0 0', paddingLeft: 0 }, 'aria-label': 'Application steps' },
      STEPS.map((s, i) => {
        const isDone = i < done && i !== currentIndex;
        const isCurrent = i === currentIndex;
        const state = isDone ? '✓ DONE' : isCurrent ? '● CURRENT' : '○ PENDING';
        return h('li', { class: ['tracker-step', isDone && 'done', isCurrent && 'current'], 'aria-current': isCurrent ? 'step' : null },
          h('span', { class: 'tracker-node' }, isDone ? icon('check', 18) : String(i + 1).padStart(2, '0')),
          h('span', { class: 'tracker-label' }, s.label),
          h('span', { class: 'tracker-state' }, state));
      })),
    !compact ? h('div', { class: 'holo-progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
      h('div', { style: { width: `${pct}%` } })) : null);
}
