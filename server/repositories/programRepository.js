/**
 * Program repository. Applicant counts are ALWAYS computed from the
 * `applicants` table (never stored as a separate number that could drift).
 */
import { db } from '../db/database.js';
import { SEAT_STATUSES, programAvailability } from '../../shared/status.js';

const seatList = SEAT_STATUSES.map((s) => `'${s}'`).join(',');

const listWithCounts = db.prepare(`
  SELECT p.id, p.code, p.name, p.description, p.icon, p.capacity, p.sort_order,
         (SELECT COUNT(*) FROM applicants a
           WHERE a.selected_program = p.id AND a.status IN (${seatList})) AS applicants,
         (SELECT COUNT(*) FROM applicants a
           WHERE a.selected_program = p.id AND a.status = 'SUBMITTED') AS submitted
  FROM programs p
  WHERE p.active = 1
  ORDER BY p.sort_order, p.id
`);

const byId = db.prepare(`
  SELECT p.*,
         (SELECT COUNT(*) FROM applicants a
           WHERE a.selected_program = p.id AND a.status IN (${seatList})) AS applicants
  FROM programs p WHERE p.id = ?
`);

function decorate(p) {
  if (!p) return null;
  const applicants = Number(p.applicants);
  const capacity = Number(p.capacity);
  return {
    ...p,
    applicants,
    capacity,
    remaining: Math.max(0, capacity - applicants),
    availability: programAvailability(applicants, capacity),
  };
}

export const programRepository = {
  listWithCounts: () => listWithCounts.all().map(decorate),
  findById: (id) => decorate(byId.get(id)),

  /** Sync programs from server/config/programs.js (called at startup). */
  syncFromConfig(programs, defaultCapacity) {
    const upsert = db.prepare(`
      INSERT INTO programs (code, name, description, icon, capacity, sort_order, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(code) DO UPDATE SET name = excluded.name, description = excluded.description,
        icon = excluded.icon, capacity = excluded.capacity, sort_order = excluded.sort_order, active = 1`);
    const codes = [];
    programs.forEach((p, i) => {
      upsert.run(p.code, p.name, p.description ?? '', p.icon ?? 'cpu', p.capacity ?? defaultCapacity, i);
      codes.push(p.code);
    });
    // Programs removed from the config are hidden, not deleted (keeps history valid)
    const placeholders = codes.map(() => '?').join(',');
    db.prepare(`UPDATE programs SET active = 0 WHERE code NOT IN (${placeholders})`).run(...codes);
  },
  findByCode: (code) => db.prepare('SELECT * FROM programs WHERE code = ?').get(code) ?? null,
};
