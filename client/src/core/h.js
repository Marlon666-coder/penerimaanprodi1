/**
 * h() — a tiny helper to build DOM elements (like React.createElement).
 *
 *   h('button', { class: 'btn', onClick: () => alert('hi') }, 'CLICK')
 *
 * props:  class, style (object|string), dataset, onXxx (events), any attribute.
 * children: strings, numbers, Nodes, arrays, null/false (ignored).
 * Text is always inserted as text (never innerHTML) -> safe against XSS.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
    else if (key === 'style' && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (k.startsWith('--')) el.style.setProperty(k, v); else el.style[k] = v;
      }
    }
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'ref' && typeof value === 'function') value(el);
    else if (key in el && typeof value !== 'string') el[key] = value; // e.g. checked, value, disabled
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const child of [children].flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Replace all children of `el`. */
export function mount(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

/** Inline SVG from a trusted string (only used for our own icon set). */
export function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}
