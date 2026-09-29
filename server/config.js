/**
 * Central configuration — every value can be overridden with environment
 * variables (see .env.example). Secrets are NEVER sent to the browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load .env (Node >= 21.7 has a built-in loader, no dotenv package needed)
const envFile = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);

const env = process.env;
const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

const isProduction = env.NODE_ENV === 'production';

export const config = {
  isProduction,
  port: Number(env.PORT || 3000),
  host: env.HOST || '0.0.0.0',
  appUrl: env.APP_URL || `http://localhost:${env.PORT || 3000}`,

  /** SQLite database file (swap the repositories layer to use PostgreSQL/MySQL/Supabase). */
  databaseFile: path.resolve(ROOT_DIR, env.DATABASE_FILE || 'data/nexus.db'),

  /** Default capacity for every program (can be overridden per program in server/config/programs.js). */
  defaultCapacity: Number(env.PROGRAM_CAPACITY || 50),

  /** Year used in registration numbers, e.g. NX-2026-000124. */
  admissionYear: Number(env.ADMISSION_YEAR || new Date().getFullYear()),

  /** Set REGISTRATION_OPEN=false to close admission globally. */
  registrationOpen: bool(env.REGISTRATION_OPEN, true),

  auth: {
    jwtSecret: env.JWT_SECRET || (isProduction ? '' : 'dev-only-insecure-secret-change-me'),
    tokenTtlSeconds: Number(env.TOKEN_TTL_SECONDS || 60 * 60 * 8),
  },

  admin: {
    email: (env.ADMIN_EMAIL || (isProduction ? '' : 'admin@nexus.ac.id')).toLowerCase(),
    password: env.ADMIN_PASSWORD || (isProduction ? '' : 'Admin#2026'),
    name: env.ADMIN_NAME || 'Nexus Administrator',
  },

  /** Demo tools (RESET DEMO DATA, dummy applicants, demo account). Off by default in production. */
  demoMode: bool(env.DEMO_MODE, !isProduction),

  email: {
    provider: (env.EMAIL_PROVIDER || 'none').toLowerCase(), // none | resend | smtp
    from: env.EMAIL_FROM || 'NEXUS ADMISSION <no-reply@example.com>',
    resendApiKey: env.RESEND_API_KEY || '',
    smtp: {
      host: env.SMTP_HOST || '',
      port: Number(env.SMTP_PORT || 587),
      secure: bool(env.SMTP_SECURE, false),
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
    },
  },
};

if (isProduction) {
  const missing = [];
  if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) missing.push('JWT_SECRET (min 32 chars)');
  if (!config.admin.email || !config.admin.password) missing.push('ADMIN_EMAIL / ADMIN_PASSWORD');
  if (missing.length) {
    console.error(`[config] Missing required production settings: ${missing.join(', ')}`);
    process.exit(1);
  }
}
