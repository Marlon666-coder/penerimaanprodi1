/**
 * Applicant repository — all SQL for the `applicants` table.
 */
import { db } from '../db/database.js';
import { SEAT_STATUSES } from '../../shared/status.js';

const seatList = SEAT_STATUSES.map((s) => `'${s}'`).join(',');
const now = () => new Date().toISOString();

const SELECT_WITH_PROGRAM = `
  SELECT a.*, p.name AS program_name, p.code AS program_code
  FROM applicants a LEFT JOIN programs p ON p.id = a.selected_program`;

const PERSONAL_COLUMNS = ['name', 'email', 'nik', 'birth_place', 'birth_date', 'gender', 'address',
  'city', 'province', 'phone', 'school', 'graduation_year'];

export const applicantRepository = {
  findByUserId: (userId) => db.prepare(`${SELECT_WITH_PROGRAM} WHERE a.user_id = ?`).get(userId) ?? null,
  findById: (id) => db.prepare(`${SELECT_WITH_PROGRAM} WHERE a.id = ?`).get(id) ?? null,

  /** Insert or update the personal data of the applicant linked to `userId`. */
  savePersonal(userId, data) {
    const existing = db.prepare('SELECT id FROM applicants WHERE user_id = ?').get(userId);
    const values = PERSONAL_COLUMNS.map((c) => data[c]);
    if (existing) {
      const set = PERSONAL_COLUMNS.map((c) => `${c} = ?`).join(', ');
      db.prepare(`UPDATE applicants SET ${set}, updated_at = ? WHERE id = ?`).run(...values, now(), existing.id);
      return existing.id;
    }
    const cols = PERSONAL_COLUMNS.join(', ');
    const qs = PERSONAL_COLUMNS.map(() => '?').join(', ');
    const r = db.prepare(`INSERT INTO applicants (user_id, ${cols}, status) VALUES (?, ${qs}, 'DATA_COMPLETED')`)
      .run(userId, ...values);
    return Number(r.lastInsertRowid);
  },

  /**
   * QUOTA CORE — reserve a seat atomically.
   * The UPDATE only matches when the program still has a free seat, so the
   * check and the write happen in ONE statement (no race window).
   * Returns true when the seat was reserved.
   */
  reserveSeat(applicantId, programId) {
    const r = db.prepare(`
      UPDATE applicants
         SET selected_program = ?, status = 'PROGRAM_SELECTED', selected_at = ?, updated_at = ?
       WHERE id = ?
         AND status IN ('DATA_COMPLETED','PROGRAM_SELECTED')
         AND (SELECT COUNT(*) FROM applicants
               WHERE selected_program = ? AND status IN (${seatList}) AND id <> ?)
             < (SELECT capacity FROM programs WHERE id = ? AND active = 1)
    `).run(programId, now(), now(), applicantId, programId, applicantId, programId);
    return r.changes === 1;
  },

  /** Give the seat back (only allowed before submission). */
  releaseSeat(applicantId) {
    const r = db.prepare(`UPDATE applicants SET selected_program = NULL, selected_at = NULL,
      status = 'DATA_COMPLETED', updated_at = ? WHERE id = ? AND status = 'PROGRAM_SELECTED'`).run(now(), applicantId);
    return r.changes === 1;
  },

  /** Finalise: only a PROGRAM_SELECTED application (which already holds a seat) can be submitted. */
  submit(applicantId, registrationNumber, date = now()) {
    const r = db.prepare(`UPDATE applicants SET status = 'SUBMITTED', registration_number = ?,
      registration_date = ?, updated_at = ? WHERE id = ? AND status = 'PROGRAM_SELECTED'`)
      .run(registrationNumber, date, date, applicantId);
    return r.changes === 1;
  },

  /** Atomic sequence -> 1, 2, 3 ... (must be called inside a transaction). */
  nextSequence(name) {
    db.prepare(`INSERT INTO counters (name, value) VALUES (?, 1)
                ON CONFLICT(name) DO UPDATE SET value = value + 1`).run(name);
    return db.prepare('SELECT value FROM counters WHERE name = ?').get(name).value;
  },

  nikTakenBySubmitted: (nik, exceptId) =>
    !!db.prepare("SELECT 1 FROM applicants WHERE nik = ? AND status = 'SUBMITTED' AND id <> ?").get(nik, exceptId ?? -1),

  setEmailStatus: (id, status) => db.prepare('UPDATE applicants SET email_status = ? WHERE id = ?').run(status, id),

  /** Admin search with filters + pagination. */
  search({ q = '', programId = null, status = '', limit = 20, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (q) {
      where.push('(a.name LIKE ? OR a.email LIKE ? OR a.registration_number LIKE ? OR a.nik LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (programId) { where.push('a.selected_program = ?'); params.push(programId); }
    if (status) { where.push('a.status = ?'); params.push(status); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) AS n FROM applicants a ${w}`).get(...params).n;
    const rows = db.prepare(`${SELECT_WITH_PROGRAM} ${w}
      ORDER BY COALESCE(a.registration_date, a.updated_at) DESC, a.id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);
    return { total: Number(total), rows };
  },

  countByStatus: () => db.prepare('SELECT status, COUNT(*) AS n FROM applicants GROUP BY status').all(),
  countAll: () => Number(db.prepare('SELECT COUNT(*) AS n FROM applicants').get().n),

  insertRaw(row) {
    const cols = Object.keys(row);
    db.prepare(`INSERT INTO applicants (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .run(...cols.map((c) => row[c]));
  },
  deleteAll: () => db.prepare('DELETE FROM applicants').run(),
  deleteDummies: () => db.prepare('DELETE FROM applicants WHERE is_dummy = 1').run().changes,
  resetCounters: () => db.prepare('DELETE FROM counters').run(),
};
