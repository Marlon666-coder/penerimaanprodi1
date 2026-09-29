/**
 * BUILD THE STATIC SITE  →  dist/
 * -------------------------------
 * Produces a self-contained folder that runs on ANY static host
 * (GitHub Pages, Netlify, Vercel, S3 …) with NO server:
 *
 *   1. copies client/ (index.html, styles, src, favicon)
 *   2. copies shared/ into dist/shared so /shared/* imports still resolve
 *   3. rewrites absolute paths ("/styles/…", "/shared/…", "/src/…", "/favicon")
 *      to RELATIVE paths ("styles/…", "shared/…") so the site works under a
 *      sub-path like https://user.github.io/penerimaanprodi1/
 *   4. adds 404.html (SPA fallback) and .nojekyll (so GitHub Pages serves /src)
 *
 * Run:  npm run build
 * Then deploy the dist/ folder (or push it with: npm run deploy:pages).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const rel = (p) => path.relative(ROOT, p);

function rm(dir) { fs.rmSync(dir, { recursive: true, force: true }); }
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Rewrite root-absolute references to relative so the app works under a sub-path. */
function fixHtml(html) {
  return html
    .replace(/(href|src)="\/(styles|src|favicon|shared)/g, '$1="$2')
    .replace(/href="\/"/g, 'href="./"');
}

console.log('› cleaning dist/');
rm(DIST);
fs.mkdirSync(DIST, { recursive: true });

console.log('› copying client → dist');
copyDir(path.join(ROOT, 'client'), DIST);

console.log('› copying shared → dist/shared');
copyDir(path.join(ROOT, 'shared'), path.join(DIST, 'shared'));

// index.html: relative paths
const indexPath = path.join(DIST, 'index.html');
let index = fixHtml(fs.readFileSync(indexPath, 'utf8'));
fs.writeFileSync(indexPath, index);
// SPA fallback for deep links / refresh on unknown routes
fs.writeFileSync(path.join(DIST, '404.html'), index);
// tell GitHub Pages NOT to run Jekyll (which would ignore the /src folder)
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

// Rewrite absolute ES-module imports ('/shared/…') to relative in every .js file.
function fixImports(dir, depth) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { fixImports(full, depth + 1); continue; }
    if (!entry.name.endsWith('.js')) continue;
    let code = fs.readFileSync(full, 'utf8');
    if (!code.includes("'/shared/") && !code.includes('"/shared/')) continue;
    const prefix = '../'.repeat(depth); // from this file back to dist root
    code = code.replace(/(['"])\/shared\//g, `$1${prefix}shared/`);
    fs.writeFileSync(full, code);
  }
}
console.log('› rewriting /shared imports to relative');
fixImports(path.join(DIST, 'src'), 1); // dist/src is depth 1 under dist

console.log(`\n✓ Static site built at ${rel(DIST)}`);
console.log('  Deploy the dist/ folder, or run:  npm run deploy:pages\n');
