/**
 * Database connection + schema (SQLite via Node's built-in `node:sqlite`).
 *
 * Why SQLite? It is a real, file-based SQL database that needs zero
 * installation. The SQL is standard, so moving to PostgreSQL / MySQL /
 * Supabase only requires rewriting the files in server/repositories/.
 *
 * QUOTA SAFETY — two independent layers:
 *   1. applicationService uses a write transaction (BEGIN IMMEDIATE) and a
 *      conditional UPDATE that only succeeds while seats remain.
 *   2. The triggers below make the DATABASE itself reject any insert/update
 *      that would put a program over capacity, even if some future code
 *      forgets to check.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });

export const db = new DatabaseSync(config.databaseFile);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'applicant' CHECK (role IN ('applicant','admin')),
    is_demo       INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS programs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    icon        TEXT    NOT NULL DEFAULT 'cpu',
    capacity    INTEGER NOT NULL CHECK (capacity >= 0),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1
  );

  -- One row per applicant (the "Applicant" entity of the spec).
  -- user_id is NULL for dummy/demo applicants that have no login account.
  CREATE TABLE IF NOT EXISTS applicants (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    registration_number TEXT    UNIQUE,
    name                TEXT    NOT NULL,
    email               TEXT    NOT NULL,
    nik                 TEXT    NOT NULL,
    birth_place         TEXT    NOT NULL,
    birth_date          TEXT    NOT NULL,
    gender              TEXT    NOT NULL CHECK (gender IN ('MALE','FEMALE')),
    address             TEXT    NOT NULL,
    city                TEXT    NOT NULL,
    province            TEXT    NOT NULL,
    phone               TEXT    NOT NULL,
    school              TEXT    NOT NULL,
    graduation_year     INTEGER NOT NULL,
    selected_program    INTEGER REFERENCES programs(id),
    selected_at         TEXT,
    registration_date   TEXT,
    status              TEXT    NOT NULL DEFAULT 'DATA_COMPLETED'
                        CHECK (status IN ('DATA_COMPLETED','PROGRAM_SELECTED','SUBMITTED')),
    email_status        TEXT,
    is_dummy            INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_applicants_program_status ON applicants(selected_program, status);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_applicants_nik_submitted ON applicants(nik) WHERE status = 'SUBMITTED';

  CREATE TABLE IF NOT EXISTS password_resets (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code_hash  TEXT    NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0
  );

  -- Sequence for registration numbers (NX-2026-000124)
  CREATE TABLE IF NOT EXISTS counters (
    name  TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );

  -- ===== QUOTA GUARD TRIGGERS (database-level protection) =====
  -- Reject a NEW seat when the program already has >= capacity seats.
  CREATE TRIGGER IF NOT EXISTS trg_quota_insert
  BEFORE INSERT ON applicants
  WHEN NEW.selected_program IS NOT NULL AND NEW.status IN ('PROGRAM_SELECTED','SUBMITTED')
  BEGIN
    SELECT RAISE(ABORT, 'PROGRAM_FULL')
    WHERE (SELECT COUNT(*) FROM applicants
           WHERE selected_program = NEW.selected_program
             AND status IN ('PROGRAM_SELECTED','SUBMITTED'))
          >= (SELECT capacity FROM programs WHERE id = NEW.selected_program);
  END;

  -- Same guard for updates, but only when the row is taking a NEW seat
  -- (PROGRAM_SELECTED -> SUBMITTED in the same program keeps its seat).
  CREATE TRIGGER IF NOT EXISTS trg_quota_update
  BEFORE UPDATE OF selected_program, status ON applicants
  WHEN NEW.selected_program IS NOT NULL
   AND NEW.status IN ('PROGRAM_SELECTED','SUBMITTED')
   AND (OLD.selected_program IS NOT NEW.selected_program
        OR OLD.status NOT IN ('PROGRAM_SELECTED','SUBMITTED'))
  BEGIN
    SELECT RAISE(ABORT, 'PROGRAM_FULL')
    WHERE (SELECT COUNT(*) FROM applicants
           WHERE selected_program = NEW.selected_program
             AND status IN ('PROGRAM_SELECTED','SUBMITTED')
             AND id <> NEW.id)
          >= (SELECT capacity FROM programs WHERE id = NEW.selected_program);
  END;

  -- A submitted application is locked forever.
  CREATE TRIGGER IF NOT EXISTS trg_submitted_locked
  BEFORE UPDATE OF selected_program, status, name, nik, birth_date ON applicants
  WHEN OLD.status = 'SUBMITTED'
  BEGIN
    SELECT RAISE(ABORT, 'APPLICATION_LOCKED');
  END;
`);

/**
 * Run `fn` inside a write transaction. BEGIN IMMEDIATE takes the write lock
 * up-front, so two concurrent requests (or processes) can never both read
 * "49/50" and both insert — the second one waits and then sees "50/50".
 */
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
