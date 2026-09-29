/** Top navigation with hamburger menu on mobile. Links adapt to the signed-in role. */
import { h, mount } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { store, logout } from '../core/store.js';
import { navigate, currentPath } from '../core/router.js';
import { toast } from '../ui/toast.js';

export function Navbar(host) {
  let open = false;
  let lastKey = '';
  const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  function links(user) {
    const items = [['/', 'Home', 'home'], ['/programs', 'Programs', 'grid']];
    if (user?.role === 'applicant') items.push(['/dashboard', 'Dashboard', 'chart']);
    if (user?.role === 'admin') items.push(['/admin', 'Admin', 'shield']);
    return items;
  }

  function render() {
    const { user } = store.get();
    const path = currentPath();
    const key = `${user?.id}|${user?.name}|${path}|${open}`;
    if (key === lastKey) return; // nothing changed
    lastKey = key;

    const menu = h('nav', { class: ['nav-links', open && 'open'], id: 'nav-menu', 'aria-label': 'Main' },
      links(user).map(([to, label, ic]) => h('a', {
        class: ['nav-link', path === to && 'active'], href: `#${to}`, 'aria-current': path === to ? 'page' : null,
        onClick: () => { open = false; },
      }, icon(ic, 16), label)),
      user
        ? h('div', { class: 'nav-user' },
          h('span', { class: 'avatar', title: user.email }, initials(user.name)),
          h('button', {
            class: 'nav-link', onClick: () => { open = false; logout(); toast('Signed out. See you soon.', 'info'); navigate('/'); },
          }, icon('logout', 16), 'Logout'))
        : [
          h('a', { class: ['nav-link', path === '/login' && 'active'], href: '#/login', onClick: () => { open = false; } }, icon('login', 16), 'Sign In'),
          h('a', { class: 'btn btn-primary btn-sm', href: '#/register', onClick: () => { open = false; } }, 'Register'),
        ]);

    mount(host, h('div', { class: 'navbar' },
      h('div', { class: 'container nav-inner' },
        h('a', { class: 'brand', href: '#/', 'aria-label': 'NEXUS ADMISSION home' },
          h('span', { class: 'brand-mark' }, 'N'),
          h('span', { class: 'brand-name' }, 'NEXUS', h('small', {}, 'ADMISSION'))),
        menu,
        h('button', {
          class: 'icon-btn nav-toggle', 'aria-label': open ? 'Close menu' : 'Open menu', 'aria-expanded': String(open), 'aria-controls': 'nav-menu',
          onClick: () => { open = !open; render(); },
        }, icon(open ? 'x' : 'menu', 20)))));
  }

  render();
  // update(path) is called on route change (closes the mobile menu); update() on data change
  return { update: (path) => { if (path) open = false; render(); } };
}
