/** Toast notifications (top-right on desktop, bottom on mobile). */
import { h } from '../core/h.js';
import { icon } from './icons.js';

let host;
const ICON = { success: 'check', error: 'alert', warn: 'alert', info: 'radio' };

export function toast(message, type = 'info', ms = 4200) {
  if (!host) {
    host = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const el = h('div', { class: `toast toast-${type}` }, icon(ICON[type] || 'radio', 18), h('span', {}, message),
    h('button', { class: 'toast-close', 'aria-label': 'Close', onClick: () => close() }, icon('x', 14)));
  host.append(el);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  setTimeout(close, ms);
}
