/**
 * Security helpers built on Node's `crypto` (no external packages):
 *  - scrypt password hashing (salted, memory-hard; never stores plaintext)
 *  - HS256 JSON Web Tokens for authentication
 *  - a tiny in-memory rate limiter for login / reset endpoints
 */
import crypto from 'node:crypto';
import { config } from '../config.js';

// ---------- password hashing ----------
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [algo, n, saltB64, hashB64] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length,
      { ...SCRYPT, N: Number(n) });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// A valid hash used to keep login timing constant when the email does not exist
export const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));

// ---------- JWT (HS256) ----------
const b64url = (input) => Buffer.from(input).toString('base64url');

export function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const iat = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ ...payload, iat, exp: iat + config.auth.tokenTtlSeconds }));
  const sig = crypto.createHmac('sha256', config.auth.jwtSecret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const [header, body, sig] = token.split('.');
  if (!header || !body || !sig) return null;
  const expected = crypto.createHmac('sha256', config.auth.jwtSecret).update(`${header}.${body}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- misc ----------
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/** 8-character human friendly code, e.g. "K7Q2-MX9D" (no 0/O/1/I confusion). */
export function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Fixed-window rate limiter kept in memory (use Redis in a multi-server setup). */
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  return {
    /** @returns {boolean} true when the request is allowed */
    hit(key) {
      const t = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.reset < t) {
        hits.set(key, { count: 1, reset: t + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= max;
    },
    reset(key) { hits.delete(key); },
    clear() { hits.clear(); },
  };
}
