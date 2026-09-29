/**
 * Visual effects (all respect `prefers-reduced-motion` and pause when the tab is hidden):
 *  - particle network background (canvas)
 *  - cursor glow
 *  - subtle 3D tilt for [data-tilt] panels
 *  - particle burst (success screen)
 *  - animated number counters
 */
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => matchMedia('(pointer: fine)').matches;

export function startParticles(canvas) {
  const ctx = canvas.getContext('2d');
  let w, h, dpr, particles = [], raf = null;
  const mouse = { x: -9999, y: -9999 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    const count = Math.round(Math.min(90, (innerWidth * innerHeight) / 18000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25 * dpr, vy: (Math.random() - 0.5) * 0.25 * dpr,
      r: (Math.random() * 1.6 + 0.4) * dpr, hue: Math.random() < 0.7 ? 185 : 262,
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    const linkDist = 120 * dpr;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      // gentle repel from cursor
      const dxm = p.x - mouse.x, dym = p.y - mouse.y, dm = Math.hypot(dxm, dym);
      if (dm < 110 * dpr && dm > 0) { p.x += (dxm / dm) * 0.6; p.y += (dym / dm) * 0.6; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 100%, 65%, 0.8)`;
      ctx.fill();
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < linkDist) {
          ctx.strokeStyle = `rgba(0, 245, 255, ${0.12 * (1 - d / linkDist)})`;
          ctx.lineWidth = dpr * 0.6;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(frame);
  }

  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', (e) => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; } else if (!raf && !reduced()) frame();
  });
  if (reduced()) { frame(); cancelAnimationFrame(raf); } else frame();
}

export function startCursorGlow(el) {
  if (!finePointer() || reduced()) { el.remove(); return; }
  let x = 0, y = 0, tx = 0, ty = 0;
  addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; el.style.opacity = '1'; });
  document.addEventListener('pointerleave', () => { el.style.opacity = '0'; });
  (function loop() {
    x += (tx - x) * 0.18; y += (ty - y) * 0.18;
    el.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(loop);
  })();
}

/** Panels with [data-tilt] rotate slightly towards the mouse (desktop only). */
export function startTilt() {
  if (!finePointer() || reduced()) return;
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('[data-tilt]');
    document.querySelectorAll('[data-tilt].tilting').forEach((o) => { if (o !== el) reset(o); });
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const max = Number(el.dataset.tilt) || 6;
    el.classList.add('tilting');
    el.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
  });
  function reset(el) {
    el.classList.remove('tilting');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }
}

/** Particle explosion from the centre of `anchor` (success screen). */
export function particleBurst(anchor, count = 90) {
  if (reduced()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'burst-canvas';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  const r = anchor.getBoundingClientRect();
  const cx = (r.left + r.width / 2) * dpr, cy = (r.top + r.height / 2) * dpr;
  const colors = ['#00F5FF', '#8B5CF6', '#2563EB', '#F8FAFC'];
  const parts = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2, s = (Math.random() * 7 + 2) * dpr;
    return { x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: colors[Math.floor(Math.random() * colors.length)], size: (Math.random() * 3 + 1) * dpr };
  });
  (function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive++;
      p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy = p.vy * 0.96 + 0.05 * dpr; p.life -= 0.012;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.c;
      ctx.shadowColor = p.c; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    if (alive) requestAnimationFrame(loop); else canvas.remove();
  })();
}

/** Animate a number from its current value to `to`. */
export function countTo(el, to, ms = 900) {
  const from = Number(el.dataset.value || 0);
  el.dataset.value = to;
  if (reduced() || from === to) { el.textContent = to; return; }
  const t0 = performance.now();
  (function step(t) {
    const k = Math.min(1, (t - t0) / ms);
    const eased = 1 - (1 - k) ** 3;
    el.textContent = Math.round(from + (to - from) * eased);
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}
