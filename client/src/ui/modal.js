/**
 * Modal dialogs.
 *   await confirmDialog({ title, message, confirmText, danger }) -> true/false
 *   openModal({ title, content, wide }) -> { close }
 */
import { h } from '../core/h.js';
import { icon } from './icons.js';

export function openModal({ title, content, footer, wide = false, onClose }) {
  const previous = document.activeElement;
  const close = () => {
    overlay.classList.add('out');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { overlay.remove(); previous?.focus?.(); }, 200);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const dialog = h('div', { class: ['modal holo-panel', wide && 'modal-wide'], role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' },
      h('h3', { class: 'modal-title' }, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onClick: close }, icon('x', 18))),
    h('div', { class: 'modal-body' }, content),
    footer ? h('div', { class: 'modal-foot' }, footer) : null);
  const overlay = h('div', { class: 'modal-overlay', onClick: (e) => { if (e.target === overlay) close(); } }, dialog);
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  setTimeout(() => dialog.querySelector('button.btn, button')?.focus(), 30);
  return { close, dialog };
}

export function confirmDialog({ title = 'ARE YOU SURE?', message, confirmText = 'CONFIRM', cancelText = 'CANCEL', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } m.close(); };
    const cancelBtn = h('button', { class: 'btn btn-ghost', onClick: () => finish(false) }, cancelText);
    const okBtn = h('button', { class: ['btn', danger ? 'btn-danger' : 'btn-primary'], onClick: () => finish(true) }, confirmText);
    const m = openModal({
      title,
      content: h('div', { class: 'confirm-body' }, h('div', { class: ['confirm-icon', danger && 'danger'] }, icon('alert', 34)), h('p', {}, message)),
      footer: [cancelBtn, okBtn],
      onClose: () => { if (!done) { done = true; resolve(false); } },
    });
    setTimeout(() => cancelBtn.focus(), 40);
  });
}
