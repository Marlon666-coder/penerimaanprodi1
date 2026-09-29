/**
 * NEXUS ADMISSION — server entry point.
 * Serves the REST API (/api/*) and the frontend (client/ + shared/).
 * Run: npm start   (or npm run dev for auto-restart on file changes)
 */
import http from 'node:http';
import path from 'node:path';
import { config, ROOT_DIR } from './config.js';
import { router } from './routes/index.js';
import { ApiError, sendJson, readJson, serveStatic } from './lib/http.js';
import { initData } from './db/seed.js';
import { isEmailConfigured } from './services/emailService.js';

initData();

const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const SHARED_DIR = path.join(ROOT_DIR, 'shared');
const MOUNTS = [
  { prefix: '/shared/', dir: SHARED_DIR },
  { prefix: '/', dir: CLIENT_DIR },
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://localhost');

  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED' } });
    return serveStatic(req, res, MOUNTS, path.join(CLIENT_DIR, 'index.html'), config.isProduction);
  }

  const match = router.match(req.method, url.pathname);
  if (!match) return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });

  const ctx = {
    req, res, params: match.params, query: url.searchParams,
    ip: req.socket.remoteAddress || 'unknown', body: {}, user: null,
  };
  try {
    ctx.body = await readJson(req);
    let result;
    for (const handler of match.handlers) result = await handler(ctx);
    if (res.headersSent) return; // handler wrote the response itself (SSE / receipt)
    if (Array.isArray(result)) return sendJson(res, result[0], result[1]);
    return sendJson(res, 200, result ?? { ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return sendJson(res, err.status, { error: { code: err.code, message: err.message, fields: err.fields } });
    }
    console.error('[server] unexpected error:', err);
    if (!res.headersSent) sendJson(res, 500, { error: { code: 'SERVER_ERROR', message: 'Unexpected server error' } });
  }
});

server.listen(config.port, config.host, () => {
  console.log(`\n  NEXUS ADMISSION running at http://localhost:${config.port}`);
  console.log(`  mode: ${config.isProduction ? 'production' : 'development'} | demo tools: ${config.demoMode ? 'ON' : 'OFF'} | email: ${isEmailConfigured() ? config.email.provider : 'not configured'}`);
  console.log(`  database: ${config.databaseFile}\n`);
});
