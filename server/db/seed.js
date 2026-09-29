/**
 * Default data: programs, admin account, demo account and dummy applicants.
 * Dummy applicants are flagged with is_dummy = 1 so they are easy to remove
 * (Admin → REMOVE DUMMY DATA) or restore (Admin → RESET DEMO DATA / npm run reset).
 */
import { db, transaction } from './database.js';
import { config } from '../config.js';
import { PROGRAMS } from '../config/programs.js';
import { programRepository } from '../repositories/programRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { applicantRepository } from '../repositories/applicantRepository.js';
import { hashPassword } from '../lib/security.js';
import { formatRegistrationNumber } from '../services/applicationService.js';

export const DEMO_USER = { name: 'Hafiz Zikri', email: 'demo@nexus.ac.id', password: 'Demo#2026' };

const FIRST = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hana', 'Indra', 'Joko', 'Kirana', 'Lestari', 'Maya',
  'Nanda', 'Oki', 'Putri', 'Rizky', 'Sari', 'Taufik', 'Umi', 'Vina', 'Wahyu', 'Yusuf', 'Zahra', 'Arif', 'Bayu', 'Dimas', 'Farah'];
const LAST = ['Pratama', 'Saputra', 'Wijaya', 'Nugroho', 'Lestari', 'Hidayat', 'Kusuma', 'Santoso', 'Rahmawati', 'Siregar',
  'Harahap', 'Putra', 'Setiawan', 'Permata', 'Utami', 'Gunawan', 'Firmansyah', 'Anggraini'];
const CITIES = [['Jakarta Selatan', 'DKI Jakarta'], ['Bandung', 'Jawa Barat'], ['Surabaya', 'Jawa Timur'], ['Medan', 'Sumatera Utara'],
  ['Yogyakarta', 'DI Yogyakarta'], ['Semarang', 'Jawa Tengah'], ['Makassar', 'Sulawesi Selatan'], ['Denpasar', 'Bali'],
  ['Pekanbaru', 'Riau'], ['Balikpapan', 'Kalimantan Timur']];

/** Deterministic pseudo-random generator, so every reset gives the same demo data. */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function syncPrograms() {
  programRepository.syncFromConfig(PROGRAMS, config.defaultCapacity);
}

export function ensureAdmin() {
  if (!config.admin.email || !config.admin.password) return;
  if (!userRepository.findByEmail(config.admin.email)) {
    userRepository.create({ name: config.admin.name, email: config.admin.email, passwordHash: hashPassword(config.admin.password), role: 'admin' });
    console.log(`[seed] admin account created: ${config.admin.email}`);
  }
}

function seedDummies() {
  const rand = rng(2026);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const year = config.admissionYear;
  let n = 0;
  const base = Date.now() - 30 * 24 * 3600 * 1000;

  const make = (status, programId) => {
    n += 1;
    const [city, province] = pick(CITIES);
    const first = pick(FIRST);
    const last = pick(LAST);
    const date = new Date(base + n * (30 * 24 * 3600 * 1000) / 260).toISOString();
    const row = {
      name: `${first} ${last}`,
      email: `${first}.${last}.${n}@example.com`.toLowerCase(),
      nik: `32${String(10000000000000 + n * 7919).slice(0, 14)}`,
      birth_place: city,
      birth_date: `${year - 18 - Math.floor(rand() * 2)}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`,
      gender: rand() < 0.5 ? 'MALE' : 'FEMALE',
      address: `Jl. ${pick(['Merdeka', 'Sudirman', 'Diponegoro', 'Gatot Subroto', 'Ahmad Yani'])} No. ${1 + Math.floor(rand() * 200)}`,
      city,
      province,
      phone: `08${String(1100000000 + Math.floor(rand() * 8e9)).slice(0, 10)}`,
      school: `SMA Negeri ${1 + Math.floor(rand() * 20)} ${city}`,
      graduation_year: year,
      selected_program: programId,
      selected_at: programId ? date : null,
      status,
      is_dummy: 1,
      created_at: date,
      updated_at: date,
    };
    if (status === 'SUBMITTED') {
      row.registration_number = formatRegistrationNumber(year, applicantRepository.nextSequence(`registration_${year}`));
      row.registration_date = date;
      row.email_status = 'NOT_CONFIGURED';
    }
    applicantRepository.insertRaw(row);
  };

  for (const p of PROGRAMS) {
    const prog = programRepository.findByCode(p.code);
    const count = Math.min(p.seedApplicants ?? 0, prog.capacity); // never seed above capacity
    for (let i = 0; i < count; i++) make(i % 9 === 8 ? 'PROGRAM_SELECTED' : 'SUBMITTED', prog.id);
  }
  for (let i = 0; i < 6; i++) make('DATA_COMPLETED', null);
  return n;
}

function seedDemoUser() {
  if (!userRepository.findByEmail(DEMO_USER.email)) {
    userRepository.create({ ...DEMO_USER, passwordHash: hashPassword(DEMO_USER.password), isDemo: 1 });
  }
}

const seededFlag = () => db.prepare("SELECT value FROM counters WHERE name = 'demo_seeded'").get();

/** Called at server start. */
export function initData() {
  syncPrograms();
  ensureAdmin();
  if (config.demoMode && !seededFlag()) {
    transaction(() => {
      const n = seedDummies();
      seedDemoUser();
      db.prepare("INSERT INTO counters (name, value) VALUES ('demo_seeded', 1)").run();
      console.log(`[seed] demo data created: ${n} dummy applicants, demo user ${DEMO_USER.email}`);
    });
  }
}

/** RESET DEMO DATA: remove every applicant + applicant account, then restore the default demo state. */
export function resetDemoData() {
  return transaction(() => {
    applicantRepository.deleteAll();
    userRepository.deleteAllApplicants();
    applicantRepository.resetCounters();
    syncPrograms();
    const n = seedDummies();
    seedDemoUser();
    db.prepare("INSERT INTO counters (name, value) VALUES ('demo_seeded', 1)").run();
    return { dummyApplicants: n };
  });
}

/** Remove only dummy applicants (real registrations are kept). */
export function removeDummyData() {
  return { removed: transaction(() => applicantRepository.deleteDummies()) };
}
