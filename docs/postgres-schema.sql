-- =====================================================================
-- NEXUS ADMISSION — PostgreSQL / Supabase schema (migration target)
-- Same tables as server/db/database.js, plus a quota-safe function.
-- =====================================================================

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         CITEXT NOT NULL UNIQUE,          -- CREATE EXTENSION citext;
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'applicant' CHECK (role IN ('applicant','admin')),
  is_demo       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE programs (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT 'cpu',
  capacity    INT  NOT NULL CHECK (capacity >= 0),
  sort_order  INT  NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE applicants (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  registration_number TEXT UNIQUE,
  name TEXT NOT NULL, email TEXT NOT NULL, nik TEXT NOT NULL,
  birth_place TEXT NOT NULL, birth_date DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('MALE','FEMALE')),
  address TEXT NOT NULL, city TEXT NOT NULL, province TEXT NOT NULL,
  phone TEXT NOT NULL, school TEXT NOT NULL, graduation_year INT NOT NULL,
  selected_program    BIGINT REFERENCES programs(id),
  selected_at         TIMESTAMPTZ,
  registration_date   TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'DATA_COMPLETED' CHECK (status IN ('DATA_COMPLETED','PROGRAM_SELECTED','SUBMITTED')),
  email_status TEXT,
  is_dummy BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON applicants (selected_program, status);
CREATE UNIQUE INDEX applicants_nik_submitted ON applicants (nik) WHERE status = 'SUBMITTED';

CREATE TABLE password_resets (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, attempts INT NOT NULL DEFAULT 0
);

CREATE SEQUENCE registration_seq;

-- ---------------------------------------------------------------------
-- QUOTA-SAFE SEAT RESERVATION
-- `FOR UPDATE` locks the program row, so concurrent calls for the same
-- program run one after another: the 51st caller always sees 50/50.
-- Returns TRUE when the seat was reserved.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reserve_seat(p_applicant BIGINT, p_program BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE cap INT; taken INT;
BEGIN
  SELECT capacity INTO cap FROM programs WHERE id = p_program AND active FOR UPDATE;
  IF cap IS NULL THEN RETURN FALSE; END IF;
  SELECT COUNT(*) INTO taken FROM applicants
   WHERE selected_program = p_program AND status IN ('PROGRAM_SELECTED','SUBMITTED') AND id <> p_applicant;
  IF taken >= cap THEN RETURN FALSE; END IF;
  UPDATE applicants SET selected_program = p_program, status = 'PROGRAM_SELECTED',
         selected_at = now(), updated_at = now()
   WHERE id = p_applicant AND status IN ('DATA_COMPLETED','PROGRAM_SELECTED');
  RETURN FOUND;
END $$;
