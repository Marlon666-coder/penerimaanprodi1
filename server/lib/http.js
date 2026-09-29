/**
 * Minimal HTTP toolkit on top of node:http (no Express needed):
 *  - Router with path params  (router.get('/api/applicants/:id', handler))
 *  - JSON body parsing with a size limit
 *  - ApiError for clean error responses
 *  - Static file server for the frontend
 */
import fs from 'node:fs';
import path from 'node:path';

export class ApiError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code machine readable code, e.g. PROGRAM_FULL
   * @param {string} message human readable message
   * @param {object} [fields] per-field validation errors
   */
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export async function readJson(req, limit = 100 * 1024) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }
}

export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, ...handlers) {
    const keys = [];
    const regex = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}/?$`);
    this.routes.push({ method, regex, keys, handlers });
  }
  get(p, ...h) { this.add('GET', p, ...h); }
  post(p, ...h) { this.add('POST', p, ...h); }
  put(p, ...h) { this.add('PUT', p, ...h); }
  delete(p, ...h) { this.add('DELETE', p, ...h); }

  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = pathname.match(r.regex);
      if (m) return { handlers: r.handlers, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

/** Serve a file from one of the allowed directories (prevents path traversal). */
export function serveStatic(req, res, mounts, fallbackFile, isProduction) {
  const url = new URL(req.url, 'http://x');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { pathname = '/'; }

  for (const { prefix, dir } of mounts) {
    if (!pathname.startsWith(prefix)) continue;
    const rel = pathname.slice(prefix.length) || 'index.html';
    const file = path.resolve(dir, `.${path.sep}${rel}`);
    if (!file.startsWith(path.resolve(dir))) break;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return streamFile(res, file, isProduction);
  }
  // SPA fallback: unknown non-file paths get index.html
  if (!path.extname(pathname)) return streamFile(res, fallbackFile, isProduction);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

function streamFile(res, file, isProduction) {
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': isProduction && ext !== '.html' ? 'public, max-age=3600' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}
