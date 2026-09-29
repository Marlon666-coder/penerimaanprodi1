/** Landing page: hero, live statistics (from the database via SSE), program preview. */
import { h, mount } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { countTo } from '../ui/effects.js';
import { badge, quotaBar } from '../ui/format.js';

export function LandingPage(ctx) {
  const start = () => {
    const { user } = store.get();
    if (!user) return navigate('/register');
    navigate(user.role === 'admin' ? '/admin' : '/dashboard');
  };

  const statEls = {
    programs: h('div', { class: 'stat-value' }, '0'),
    capacity: h('div', { class: 'stat-value' }, '0'),
    applicants: h('div', { class: 'stat-value' }, '0'),
    status: h('div', { class: 'stat-value' }, '—'),
  };
  const statSubs = { applicants: h('div', { class: 'stat-sub' }), capacity: h('div', { class: 'stat-sub' }) };
  const preview = h('div', { class: 'programs-grid' });

  function statCard(label, ic, valueEl, sub, i) {
    return h('div', { class: 'holo-panel stat-card reveal scan', style: { '--i': i }, 'data-tilt': '8' },
      h('div', { class: 'stat-label' }, icon(ic, 14), label), valueEl, sub || null);
  }

  function update() {
    const snap = store.get().snapshot;
    if (!snap) return;
    const { stats, programs } = snap;
    countTo(statEls.programs, stats.totalPrograms);
    countTo(statEls.capacity, stats.totalCapacity);
    countTo(statEls.applicants, stats.applicants);
    statSubs.applicants.textContent = `${stats.submitted} submitted · live`;
    statSubs.capacity.textContent = `${stats.availableSeats} seats left`;
    statEls.status.textContent = stats.status;
    statEls.status.className = `stat-value ${stats.status === 'OPEN' ? 'open' : 'closed'}`;
    const animate = !preview.childElementCount; // animate only on first render, not on live updates
    mount(preview, programs.slice(0, 6).map((p, i) => h('button', {
      class: ['holo-panel program-card no-tilt', animate && 'reveal', p.availability === 'FULL' && 'is-full'], style: { '--i': i, textAlign: 'left', cursor: 'pointer' },
      onClick: () => navigate('/programs'), 'aria-label': `${p.name}, ${p.applicants} of ${p.capacity} seats taken`,
    },
      h('div', { class: 'program-top' }, h('div', { class: 'program-icon' }, icon(p.icon, 26)), badge(p.availability)),
      h('h3', { class: 'program-name' }, p.name),
      h('div', {}, h('div', { class: 'quota-numbers' }, h('span', {}, h('b', {}, p.applicants), ` / ${p.capacity}`), h('span', {}, `${p.remaining} left`)),
        quotaBar(p.applicants, p.capacity, p.availability)))));
  }

  ctx.onCleanup(store.subscribe(update));
  const page = h('div', {},
    h('section', { class: 'container hero' },
      h('div', { class: 'reveal' },
        h('div', { class: 'eyebrow' }, 'Admission ', new Date().getFullYear(), ' · Next-Gen Platform'),
        h('h1', { class: 'hero-title grad-text' }, 'NEXUS ADMISSION'),
        h('div', { class: 'hero-tagline' }, 'Choose Your Future. ', h('span', { class: 'muted' }, 'Build Your Legacy.')),
        h('p', { class: 'hero-desc' }, 'Platform penerimaan program studi generasi baru yang membantu kamu menemukan dan memilih program studi yang sesuai dengan masa depanmu.'),
        h('div', { class: 'hero-cta' },
          h('button', { class: 'btn btn-primary', onClick: start }, 'Start Application', icon('arrowRight', 18)),
          h('button', { class: 'btn', onClick: () => navigate('/programs') }, icon('grid', 18), 'Explore Programs'))),
      h('div', { class: 'hero-visual reveal', style: { '--i': 2 } },
        h('div', { class: 'holo-rings float' },
          h('div', { class: 'ring' }), h('div', { class: 'ring r2' }), h('div', { class: 'ring r3' }), h('div', { class: 'ring r4' }),
          h('div', { class: 'holo-core' }, icon('sparkles', 44))),
        h('div', { class: 'holo-panel hero-chip c1 float' }, h('span', { class: 'live-dot' }), 'LIVE QUOTA SYNC'),
        h('div', { class: 'holo-panel hero-chip c2 float' }, icon('shield', 14), 'SECURE · ENCRYPTED'),
        h('div', { class: 'holo-panel hero-chip c3 float' }, icon('seat', 14), 'MAX 50 / PROGRAM'))),

    h('section', { class: 'container stats-strip' },
      h('div', { class: 'grid-4' },
        statCard('Program Studi', 'grid', statEls.programs, null, 0),
        statCard('Total Kuota', 'seat', statEls.capacity, statSubs.capacity, 1),
        statCard('Pendaftar', 'users', statEls.applicants, statSubs.applicants, 2),
        statCard('Status', 'radio', statEls.status, h('div', { class: 'stat-sub' }, 'Registration'), 3))),

    h('section', { class: 'container section' },
      h('div', { class: 'row-between page-head' },
        h('div', {}, h('div', { class: 'eyebrow' }, 'Live Capacity'), h('h2', {}, 'PROGRAM MATRIX')),
        h('span', { class: 'live-label' }, h('span', { class: 'live-dot blink' }), 'REALTIME')),
      preview),

    h('section', { class: 'container section', style: { paddingTop: 0 } },
      h('div', { class: 'feature-list' },
        [['user', '01 · Create Account', 'Register with your email and a secure password.'],
          ['file', '02 · Complete Your Data', 'Identity, contact and education — saved automatically to your profile.'],
          ['check', '03 · Select & Submit', 'Pick an available program, review, submit and receive your Application ID.']]
          .map(([ic, t, d], i) => h('div', { class: 'holo-panel feature reveal', style: { '--i': i } }, icon(ic, 28), h('h3', {}, t), h('p', {}, d))))));

  update();
  return page;
}
