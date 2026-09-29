/**
 * Preview the built static site locally (to check it before deploying).
 *   npm run build && npm run preview   →  http://localhost:4173
 * This is a plain static file server; there is NO /api backend, so the app
 * runs in static mode — exactly like it will on GitHub Pages.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT || 4173);
if (!fs.existsSync(DIST)) { console.error('dist/ not found. Run "npm run build" first.'); process.exit(1); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { pathname = '/'; }
  let file = path.join(DIST, pathname === '/' ? 'index.html' : `.${path.sep}${pathname}`);
  if (!path.resolve(file).startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, path.extname(pathname) ? '404.html' : 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`\n  Static preview at http://localhost:${PORT}  (static mode — no backend)\n`));
