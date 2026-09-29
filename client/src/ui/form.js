/**
 * Form helpers: futuristic input fields with inline error messages.
 */
import { h } from '../core/h.js';
import { icon } from './icons.js';

/**
 * field({ name, label, type, value, icon, options, placeholder, autocomplete, inputmode, maxlength })
 * Returns a wrapper element with `.input` and `.setError(msg)`.
 */
export function field(opts) {
  const { name, label, type = 'text', value = '', options, hint } = opts;
  const id = `f-${name}-${Math.random().toString(36).slice(2, 7)}`;
  const errId = `${id}-err`;
  let input;
  const common = { id, name, 'aria-describedby': errId, class: 'input' };

  if (type === 'select') {
    input = h('select', common,
      h('option', { value: '' }, opts.placeholder || `Select ${label.toLowerCase()}`),
      options.map((o) => {
        const [v, t] = Array.isArray(o) ? o : [o, o];
        return h('option', { value: v, selected: String(v) === String(value) }, t);
      }));
  } else if (type === 'textarea') {
    input = h('textarea', { ...common, rows: 3, placeholder: opts.placeholder || '', maxlength: opts.maxlength }, value);
  } else if (type === 'radio') {
    input = h('div', { class: 'radio-group', role: 'radiogroup', id },
      options.map(([v, t]) => h('label', { class: 'radio-pill' },
        h('input', { type: 'radio', name, value: v, checked: v === value }), h('span', {}, t))));
  } else {
    input = h('input', {
      ...common, type, value, placeholder: opts.placeholder || '', autocomplete: opts.autocomplete || 'off',
      inputmode: opts.inputmode, maxlength: opts.maxlength, min: opts.min, max: opts.max,
    });
  }

  const err = h('div', { class: 'field-error', id: errId, role: 'alert' });
  const wrap = h('div', { class: ['field', opts.full && 'field-full'] },
    h('label', { class: 'field-label', for: id }, label),
    h('div', { class: 'field-control' }, opts.icon ? icon(opts.icon, 18, 'field-icon') : null, input,
      type === 'password' ? h('button', {
        type: 'button', class: 'pw-toggle', 'aria-label': 'Show password',
        onClick: (e) => { input.type = input.type === 'password' ? 'text' : 'password'; e.currentTarget.classList.toggle('on'); },
      }, icon('eye', 16)) : null),
    hint ? h('div', { class: 'field-hint' }, hint) : null,
    err);
  if (!opts.icon) wrap.classList.add('no-icon');

  wrap.input = input;
  wrap.setError = (msg) => {
    err.textContent = msg || '';
    wrap.classList.toggle('has-error', !!msg);
    if (input.setAttribute) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  input.addEventListener('input', () => wrap.setError(''));
  input.addEventListener('change', () => wrap.setError(''));
  return wrap;
}

/** Read values from a collection of fields: { name: value }. */
export function readFields(fields) {
  const out = {};
  for (const [name, f] of Object.entries(fields)) {
    if (f.input.classList.contains('radio-group')) {
      out[name] = f.input.querySelector('input:checked')?.value || '';
    } else out[name] = f.input.value;
  }
  return out;
}

/** Show errors ({ field: message }); returns true when there were errors. Focuses the first one. */
export function showErrors(fields, errors = {}) {
  let first = null;
  for (const [name, f] of Object.entries(fields)) {
    f.setError(errors[name]);
    if (errors[name] && !first) first = f;
  }
  first?.querySelector('input,select,textarea')?.focus();
  return !!first;
}

/** Put a button into loading state; returns a restore function. */
export function setLoading(btn, text = 'PROCESSING') {
  const original = [...btn.childNodes];
  btn.disabled = true;
  btn.classList.add('loading');
  btn.replaceChildren(h('span', { class: 'spinner' }), h('span', {}, text));
  return () => { btn.disabled = false; btn.classList.remove('loading'); btn.replaceChildren(...original); };
}

export function formAlert() {
  const el = h('div', { class: 'form-alert', role: 'alert', hidden: true });
  el.show = (msg, type = 'error') => {
    el.hidden = !msg;
    el.className = `form-alert form-alert-${type}`;
    el.replaceChildren(msg ? icon(type === 'success' ? 'check' : 'alert', 18) : '', h('span', {}, msg || ''));
  };
  return el;
}
