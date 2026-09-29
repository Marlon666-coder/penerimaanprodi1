/**
 * ================= STATIC / OFFLINE BACKEND (localStorage) =================
 * GitHub Pages (and any static host) cannot run the Node server, so when no
 * server is available the app runs entirely in the browser using this module.
 *
 * It implements the SAME endpoints and the SAME response shapes as the real
 * REST API (server/routes/index.js), so nothing in the UI changes. All data —
 * accounts, applicants, programs and the 50-seat quota — is stored in
 * localStorage. When a real server IS present, this file is never used.
 *
 * NOTE: in this static mode the browser is the only authority, so password
 * "hashing" here is just obfuscation and the quota is enforced in this single
 * tab. For real multi-user security, deploy the Node server (see README).
 */
import { PROGRAMS } from '../data/programs.js';
import { validateRegister, validateLogin, validatePasswordReset, validatePersonal, PERSONAL_FIELDS, EMAIL_RE } from '/shared/validators.js';
import { STATUS, SEAT_STATUSES, programAvailability, completedSteps } from '/shared/status.js';

const KEY = 'nexus.db.v1';
const CAPACITY = 50;
const YEAR = new Date().getFullYear();
const ADMIN = { name: 'Nexus Administrator', email: 'admin@nexus.ac.id', password: 'Admin#2026' };
const DEMO = { name: 'Hafiz Zikri', email: 'demo@nexus.ac.id', password: 'Demo#2026' };

// ---------- error type mirroring server ApiError ----------
class LocalError extends Error {
  constructor(status, code, message, fields) { super(message); this.status = status; this.code = code; this.fields = fields; }
}

// ---------- storage ----------
let db = null;
function load() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db || !db.programs) db = seed();
  return db;
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }

// ---------- helpers ----------
const now = () => new Date().toISOString();
// obfuscation only (not real security — the Node server uses scrypt)
const hash = (pw) => `h$${btoa(unescape(encodeURIComponent(`nexus:${pw}`)))}`;
const verify = (pw, stored) => stored === hash(pw);
const genToken = (userId) => `local.${btoa(JSON.stringify({ sub: userId, exp: Date.now() + 8 * 3600e3 }))}`;
function userFromToken(token) {
  try {
    const p = JSON.parse(atob(String(token).replace(/^local\./, '')));
    if (!p.exp || p.exp < Date.now()) return null;
    return db.users.find((u) => u.id === p.sub) || null;
  } catch { return null; }
}
const publicUser = (u) => (u ? { id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at } : null);

function seatsTaken(programId, exceptId) {
  return db.applicants.filter((a) => a.selected_program === programId && SEAT_STATUSES.includes(a.status) && a.id !== exceptId).length;
}
function decorateProgram(p) {
  const applicants = seatsTaken(p.id);
  const submitted = db.applicants.filter((a) => a.selected_program === p.id && a.status === STATUS.SUBMITTED).length;
  return { ...p, applicants, submitted, capacity: p.capacity, remaining: Math.max(0, p.capacity - applicants), availability: programAvailability(applicants, p.capacity) };
}
const listPrograms = () => db.programs.filter((p) => p.active).sort((a, b) => a.sort_order - b.sort_order).map(decorateProgram);
const programById = (id) => { const p = db.programs.find((x) => x.id === id && x.active); return p ? decorateProgram(p) : null; };
const applicantByUser = (uid) => db.applicants.find((a) => a.user_id === uid) || null;

function withProgram(a) {
  if (!a) return a;
  const p = a.selected_program ? db.programs.find((x) => x.id === a.selected_program) : null;
  return { ...a, program_name: p?.name ?? null, program_code: p?.code ?? null };
}

function snapshot() {
  const programs = listPrograms();
  const totalCapacity = programs.reduce((s, p) => s + p.capacity, 0);
  const applicants = programs.reduce((s, p) => s + p.applicants, 0);
  const submitted = programs.reduce((s, p) => s + p.submitted, 0);
  const anySeat = programs.some((p) => p.availability !== 'FULL');
  return {
    programs,
    stats: {
      totalPrograms: programs.length, totalCapacity, applicants, submitted,
      availableSeats: Math.max(0, totalCapacity - applicants),
      fullPrograms: programs.filter((p) => p.availability === 'FULL').length,
      status: anySeat ? 'OPEN' : 'CLOSED',
    },
    updatedAt: now(),
  };
}

// ---------- realtime (same tab + cross-tab via storage event) ----------
const listeners = new Set();
function broadcast() {
  const snap = snapshot();
  listeners.forEach((fn) => { try { fn(snap); } catch { /* ignore */ } });
  try { localStorage.setItem('nexus.ping', String(Date.now())); } catch { /* ignore */ }
}
addEventListener('storage', (e) => { if (e.key === 'nexus.ping' || e.key === KEY) { db = null; load(); listeners.forEach((fn) => fn(snapshot())); } });

// ---------- seed ----------
function normalizePersonal(body) {
  const d = {};
  for (const f of PERSONAL_FIELDS) d[f] = typeof body[f] === 'string' ? body[f].trim() : body[f];
  d.phone = String(d.phone ?? '').replace(/[\s-]/g, '');
  d.email = String(d.email ?? '').toLowerCase();
  d.graduation_year = Number(d.graduation_year);
  return d;
}

function seed() {
  const fresh = { users: [], applicants: [], programs: [], seq: 0, regSeq: 0 };
  db = fresh;
  PROGRAMS.forEach((p, i) => fresh.programs.push({
    id: i + 1, code: p.code, name: p.name, description: p.description ?? '', icon: p.icon ?? 'cpu',
    capacity: p.capacity ?? CAPACITY, sort_order: i, active: true,
  }));
  fresh.users.push({ id: 1, name: ADMIN.name, email: ADMIN.email, password_hash: hash(ADMIN.password), role: 'admin', is_demo: 1, created_at: now() });
  fresh.users.push({ id: 2, name: DEMO.name, email: DEMO.email, password_hash: hash(DEMO.password), role: 'applicant', is_demo: 1, created_at: now() });
  fresh.seq = 2;
  seedDummies();
  save();
  return fresh;
}

function seedDummies() {
  const FIRST = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hana', 'Indra', 'Joko', 'Kirana', 'Lestari', 'Maya', 'Nanda', 'Oki', 'Putri', 'Rizky', 'Sari', 'Taufik', 'Umi', 'Vina', 'Wahyu', 'Yusuf', 'Zahra', 'Arif', 'Bayu', 'Dimas', 'Farah'];
  const LAST = ['Pratama', 'Saputra', 'Wijaya', 'Nugroho', 'Lestari', 'Hidayat', 'Kusuma', 'Santoso', 'Rahmawati', 'Siregar', 'Harahap', 'Putra', 'Setiawan', 'Permata', 'Utami', 'Gunawan', 'Firmansyah', 'Anggraini'];
  const CITIES = [['Jakarta Selatan', 'DKI Jakarta'], ['Bandung', 'Jawa Barat'], ['Surabaya', 'Jawa Timur'], ['Medan', 'Sumatera Utara'], ['Yogyakarta', 'DI Yogyakarta'], ['Semarang', 'Jawa Tengah'], ['Makassar', 'Sulawesi Selatan'], ['Denpasar', 'Bali']];
  let s = 2026; const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  let n = 0; const base = Date.now() - 30 * 864e5;
  const make = (status, programId) => {
    n++;
    const [city, province] = pick(CITIES); const first = pick(FIRST); const last = pick(LAST);
    const date = new Date(base + n * (30 * 864e5) / 260).toISOString();
    const a = {
      id: ++db.seq, user_id: null, registration_number: null, name: `${first} ${last}`,
      email: `${first}.${last}.${n}@example.com`.toLowerCase(), nik: `32${String(10000000000000 + n * 7919).slice(0, 14)}`,
      birth_place: city, birth_date: `${YEAR - 18}-0${1 + (n % 8)}-1${n % 9}`, gender: rand() < 0.5 ? 'MALE' : 'FEMALE',
      address: `Jl. ${pick(['Merdeka', 'Sudirman', 'Diponegoro'])} No. ${1 + Math.floor(rand() * 200)}`, city, province,
      phone: `08${String(1100000000 + Math.floor(rand() * 8e9)).slice(0, 10)}`, school: `SMA Negeri ${1 + Math.floor(rand() * 20)} ${city}`,
      graduation_year: YEAR, selected_program: programId, selected_at: programId ? date : null, registration_date: null,
      status, email_status: null, is_dummy: 1, created_at: date, updated_at: date,
    };
    if (status === STATUS.SUBMITTED) { a.registration_number = `NX-${YEAR}-${String(++db.regSeq).padStart(6, '0')}`; a.registration_date = date; a.email_status = 'NOT_CONFIGURED'; }
    db.applicants.push(a);
  };
  for (const p of PROGRAMS) {
    const prog = db.programs.find((x) => x.code === p.code);
    const count = Math.min(p.seedApplicants ?? 0, prog.capacity);
    for (let i = 0; i < count; i++) make(i % 9 === 8 ? STATUS.PROGRAM_SELECTED : STATUS.SUBMITTED, prog.id);
  }
  for (let i = 0; i < 6; i++) make(STATUS.DATA_COMPLETED, null);
}

// ---------- auth ----------
function register(body) {
  const errors = validateRegister(body);
  if (Object.keys(errors).length) throw new LocalError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields', errors);
  if (db.users.some((u) => u.email.toLowerCase() === body.email.trim().toLowerCase())) throw new LocalError(409, 'EMAIL_TAKEN', 'An account with this email already exists', { email: 'Email is already registered' });
  const user = { id: ++db.seq, name: body.name.trim(), email: body.email.trim().toLowerCase(), password_hash: hash(body.password), role: 'applicant', is_demo: 0, created_at: now() };
  db.users.push(user); save();
  return { token: genToken(user.id), user: publicUser(user) };
}
function login(body) {
  const errors = validateLogin(body);
  if (Object.keys(errors).length) throw new LocalError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields', errors);
  const user = db.users.find((u) => u.email.toLowerCase() === body.email.trim().toLowerCase());
  if (!user || !verify(body.password, user.password_hash)) throw new LocalError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  return { token: genToken(user.id), user: publicUser(user) };
}
function forgotPassword(body) {
  if (!EMAIL_RE.test(String(body.email ?? '').trim())) throw new LocalError(422, 'VALIDATION_ERROR', 'Enter a valid email', { email: 'Email format is invalid' });
  const user = db.users.find((u) => u.email.toLowerCase() === body.email.trim().toLowerCase());
  const generic = { message: 'If the email is registered, a reset code has been issued.', delivery: 'DEMO' };
  if (!user) return generic;
  const code = 'DEMO-1234'; // static demo mode: no email service in the browser
  user._reset = { code, exp: Date.now() + 15 * 60e3 }; save();
  return { ...generic, demoCode: code };
}
function resetPassword(body) {
  const errors = validatePasswordReset(body);
  if (Object.keys(errors).length) throw new LocalError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields', errors);
  const invalid = new LocalError(400, 'INVALID_RESET_CODE', 'The reset code is invalid or has expired', { token: 'Invalid or expired code' });
  const user = db.users.find((u) => u.email.toLowerCase() === String(body.email).trim().toLowerCase());
  if (!user || !user._reset || user._reset.exp < Date.now() || user._reset.code !== String(body.token).trim().toUpperCase()) throw invalid;
  user.password_hash = hash(body.password); delete user._reset; save();
  return { message: 'Password updated. You can sign in now.' };
}

// ---------- application ----------
function dashboard(user) {
  const applicant = withProgram(applicantByUser(user.id));
  const status = applicant?.status ?? STATUS.NOT_STARTED;
  const program = applicant?.selected_program ? programById(applicant.selected_program) : null;
  return { user: publicUser(user), applicant, program, status, completedSteps: completedSteps(status) };
}
function savePersonal(user, body) {
  const current = applicantByUser(user.id);
  if (current?.status === STATUS.SUBMITTED) throw new LocalError(409, 'APPLICATION_LOCKED', 'Your application has already been submitted and can no longer be changed.');
  const data = normalizePersonal(body);
  const errors = validatePersonal(data);
  if (Object.keys(errors).length) throw new LocalError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields', errors);
  if (db.applicants.some((a) => a.nik === data.nik && a.status === STATUS.SUBMITTED && a.id !== current?.id)) throw new LocalError(409, 'NIK_REGISTERED', 'This NIK is already used by a submitted application', { nik: 'NIK already registered' });
  if (current) { Object.assign(current, data, { updated_at: now() }); }
  else db.applicants.push({ id: ++db.seq, user_id: user.id, ...data, selected_program: null, selected_at: null, registration_number: null, registration_date: null, status: STATUS.DATA_COMPLETED, email_status: null, is_dummy: 0, created_at: now(), updated_at: now() });
  save();
  return dashboard(user);
}
/** QUOTA: reserve a seat only if a seat is still free. */
function selectProgram(user, programId) {
  const id = Number(programId);
  const applicant = applicantByUser(user.id);
  if (!applicant) throw new LocalError(409, 'PERSONAL_DATA_REQUIRED', 'Complete your personal data before choosing a program.');
  if (applicant.status === STATUS.SUBMITTED) throw new LocalError(409, 'APPLICATION_LOCKED', 'Your application has already been submitted and can no longer be changed.');
  const program = programById(id);
  if (!program) throw new LocalError(404, 'PROGRAM_NOT_FOUND', 'Program not found');
  if (applicant.selected_program !== id) {
    if (seatsTaken(id, applicant.id) >= program.capacity) throw new LocalError(409, 'PROGRAM_FULL', `${program.name} is FULL (${program.applicants}/${program.capacity}). Please choose another program.`);
    applicant.selected_program = id; applicant.status = STATUS.PROGRAM_SELECTED; applicant.selected_at = now(); applicant.updated_at = now();
    save(); broadcast();
  }
  return dashboard(user);
}
function releaseProgram(user) {
  const applicant = applicantByUser(user.id);
  if (!applicant) throw new LocalError(409, 'PERSONAL_DATA_REQUIRED', 'No application found');
  if (applicant.status === STATUS.SUBMITTED) throw new LocalError(409, 'APPLICATION_LOCKED', 'Your application has already been submitted and can no longer be changed.');
  if (applicant.status === STATUS.PROGRAM_SELECTED) { applicant.selected_program = null; applicant.selected_at = null; applicant.status = STATUS.DATA_COMPLETED; applicant.updated_at = now(); save(); broadcast(); }
  return dashboard(user);
}
function submit(user, body) {
  if (body.confirm !== true) throw new LocalError(422, 'CONFIRMATION_REQUIRED', 'You must confirm that the information is correct', { confirm: 'Required' });
  const applicant = applicantByUser(user.id);
  if (!applicant) throw new LocalError(409, 'PERSONAL_DATA_REQUIRED', 'Complete your personal data first.');
  if (applicant.status === STATUS.SUBMITTED) throw new LocalError(409, 'ALREADY_SUBMITTED', 'This account has already submitted an application.');
  if (applicant.status !== STATUS.PROGRAM_SELECTED || !applicant.selected_program) throw new LocalError(409, 'PROGRAM_REQUIRED', 'Select a study program before submitting.');
  const errors = validatePersonal(applicant);
  if (Object.keys(errors).length) throw new LocalError(422, 'VALIDATION_ERROR', 'Your personal data is incomplete', errors);
  applicant.status = STATUS.SUBMITTED;
  applicant.registration_number = `NX-${YEAR}-${String(++db.regSeq).padStart(6, '0')}`;
  applicant.registration_date = now(); applicant.updated_at = now(); applicant.email_status = 'NOT_CONFIGURED';
  save(); broadcast();
  return { ...dashboard(user), email: { status: 'NOT_CONFIGURED' } };
}
function receiptHtml(user) {
  const a = withProgram(applicantByUser(user.id));
  if (!a || a.status !== STATUS.SUBMITTED) throw new LocalError(409, 'NOT_SUBMITTED', 'A receipt is only available after submission.');
  const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = new Date(a.registration_date).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
  const rows = [['Registration ID', a.registration_number], ['Name', a.name], ['NIK', a.nik], ['Place / Date of Birth', `${a.birth_place}, ${a.birth_date}`], ['Gender', a.gender], ['Address', `${a.address}, ${a.city}, ${a.province}`], ['Phone', a.phone], ['Email', a.email], ['School', `${a.school} (${a.graduation_year})`], ['Program', a.program_name], ['Status', a.status], ['Registration Date', date]];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(a.registration_number)}</title><style>body{font-family:Arial,sans-serif;background:#050816;color:#F8FAFC;padding:40px}.card{max-width:720px;margin:auto;border:1px solid #00F5FF55;border-radius:16px;padding:32px;background:#0b1026}h1{color:#00F5FF;letter-spacing:4px;margin:0}h2{color:#8B5CF6;font-size:14px;letter-spacing:3px}td{padding:8px 12px;border-bottom:1px solid #ffffff14}td:first-child{color:#94a3b8;width:40%}.id{font-size:26px;font-weight:bold;letter-spacing:3px;color:#00F5FF;margin:16px 0}@media print{body{background:#fff;color:#000}.card{background:#fff;border-color:#000}td:first-child{color:#333}h1,.id{color:#000}}</style></head><body><div class="card"><h1>NEXUS ADMISSION</h1><h2>REGISTRATION RECEIPT</h2><div class="id">${esc(a.registration_number)}</div><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table><p style="color:#94a3b8;font-size:12px;margin-top:24px">Generated ${esc(new Date().toLocaleString('en-GB'))}. Static demo mode. Use Print → Save as PDF.</p></div></body></html>`;
}

// ---------- admin ----------
function adminOverview() {
  const snap = snapshot();
  const byStatus = { [STATUS.DATA_COMPLETED]: 0, [STATUS.PROGRAM_SELECTED]: 0, [STATUS.SUBMITTED]: 0 };
  for (const a of db.applicants) if (byStatus[a.status] !== undefined) byStatus[a.status]++;
  return { ...snap, stats: { ...snap.stats, totalRecords: db.applicants.length }, byStatus, demoMode: true };
}
function adminList(params) {
  const q = (params.q || '').trim().toLowerCase();
  const programId = Number(params.program) || null;
  const status = params.status || '';
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const page = Math.max(1, Number(params.page) || 1);
  let rows = db.applicants.map(withProgram).filter((a) => {
    if (q && !(`${a.name} ${a.email} ${a.registration_number || ''} ${a.nik}`.toLowerCase().includes(q))) return false;
    if (programId && a.selected_program !== programId) return false;
    if (status && a.status !== status) return false;
    return true;
  }).sort((x, y) => String(y.registration_date || y.updated_at).localeCompare(String(x.registration_date || x.updated_at)) || y.id - x.id);
  const total = rows.length;
  return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), rows: rows.slice((page - 1) * limit, (page - 1) * limit + limit) };
}
function adminDetail(id) {
  const a = withProgram(db.applicants.find((x) => x.id === Number(id)));
  if (!a) throw new LocalError(404, 'NOT_FOUND', 'Applicant not found');
  return a;
}
function adminReset(mode) {
  if (mode === 'demo') { localStorage.removeItem(KEY); db = null; seed(); }
  else if (mode === 'dummies') { db.applicants = db.applicants.filter((a) => !a.is_dummy); save(); }
  else throw new LocalError(422, 'VALIDATION_ERROR', 'mode must be "demo" or "dummies"');
  broadcast();
  return { ok: true, mode, dummyApplicants: db.applicants.filter((a) => a.is_dummy).length, removed: mode === 'dummies' ? 1 : 0 };
}

// ---------- request router (mirrors server routes) ----------
function auth(token) { const u = userFromToken(token); if (!u) throw new LocalError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.'); return u; }
function applicant(token) { const u = auth(token); if (u.role !== 'applicant') throw new LocalError(403, 'FORBIDDEN', 'Admin accounts cannot submit applications'); return u; }
function admin(token) { const u = auth(token); if (u.role !== 'admin') throw new LocalError(403, 'FORBIDDEN', 'Administrator access required'); return u; }

/**
 * Handle a request the same way the server would.
 * @returns {Promise<any>} resolved data or a thrown LocalError
 */
export async function handleLocal(path, { method = 'GET', body = {}, token } = {}) {
  load();
  const [p, qs] = path.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const route = `${method} ${p}`;

  switch (true) {
    case route === 'POST /api/auth/register': return register(body);
    case route === 'POST /api/auth/login': return login(body);
    case route === 'GET /api/auth/me': return { user: publicUser(auth(token)) };
    case route === 'POST /api/auth/forgot-password': return forgotPassword(body);
    case route === 'POST /api/auth/reset-password': return resetPassword(body);
    case route === 'GET /api/config': return { demoMode: true, emailConfigured: false, registrationOpen: true, admissionYear: YEAR, staticMode: true };
    case route === 'GET /api/programs': return { programs: listPrograms() };
    case route === 'GET /api/stats': return snapshot().stats;
    case route === 'GET /api/health': return { ok: true, time: now() };
    case route === 'GET /api/dashboard': return dashboard(applicant(token));
    case route === 'POST /api/applicants': return savePersonal(applicant(token), body);
    case route === 'POST /api/programs/select': return selectProgram(applicant(token), body.programId);
    case route === 'POST /api/programs/release': return releaseProgram(applicant(token));
    case route === 'POST /api/applications/submit': return submit(applicant(token), body);
    case route === 'GET /api/applications/receipt': applicant(token); return { __html: receiptHtml(userFromToken(token)) };
    case route === 'GET /api/admin/overview': admin(token); return adminOverview();
    case route === 'GET /api/applicants': admin(token); return adminList(query);
    case p.startsWith('/api/applicants/') && method === 'GET': admin(token); return adminDetail(p.split('/').pop());
    case route === 'POST /api/admin/reset': admin(token); return adminReset(body.mode);
    default: throw new LocalError(404, 'NOT_FOUND', 'Endpoint not found');
  }
}

/** Subscribe to quota changes (replaces Server-Sent Events in static mode). */
export function subscribeLocal(onSnapshot) {
  load();
  listeners.add(onSnapshot);
  onSnapshot(snapshot());
  return () => listeners.delete(onSnapshot);
}
