/**
 * User repository — the ONLY place that talks SQL for the `users` table.
 * To move to PostgreSQL/Supabase, re-implement these functions with the same
 * signatures; nothing else in the app needs to change.
 */
import { db } from '../db/database.js';

const byEmail = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
const byId = db.prepare('SELECT * FROM users WHERE id = ?');
const insert = db.prepare('INSERT INTO users (name, email, password_hash, role, is_demo) VALUES (?, ?, ?, ?, ?)');
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');

export const userRepository = {
  findByEmail: (email) => byEmail.get(String(email).trim().toLowerCase()) ?? null,
  findById: (id) => byId.get(id) ?? null,
  create({ name, email, passwordHash, role = 'applicant', isDemo = 0 }) {
    const r = insert.run(name.trim(), email.trim().toLowerCase(), passwordHash, role, isDemo ? 1 : 0);
    return byId.get(Number(r.lastInsertRowid));
  },
  updatePassword: (id, passwordHash) => updatePassword.run(passwordHash, id),
  deleteAllApplicants: () => db.prepare("DELETE FROM users WHERE role = 'applicant'").run(),

  // --- password reset codes ---
  saveResetCode: (userId, codeHash, expiresAt) =>
    db.prepare(`INSERT INTO password_resets (user_id, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
                ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash,
                expires_at = excluded.expires_at, attempts = 0`).run(userId, codeHash, expiresAt),
  getResetCode: (userId) => db.prepare('SELECT * FROM password_resets WHERE user_id = ?').get(userId) ?? null,
  bumpResetAttempts: (userId) => db.prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = ?').run(userId),
  deleteResetCode: (userId) => db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId),
};

/** Remove secrets before sending a user to the client. */
export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at };
}
