/**
 * Deploy dist/ to the gh-pages branch (manual alternative to the GitHub Action).
 *
 *   npm run build && npm run deploy:pages
 *
 * Uses a temporary worktree so your working tree is untouched. Requires push
 * access to 'origin'. The recommended path is the GitHub Action in
 * .github/workflows/deploy-pages.yml (deploys automatically on push).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const BRANCH = 'gh-pages';
if (!fs.existsSync(DIST)) { console.error('dist/ not found. Run "npm run build" first.'); process.exit(1); }

const sh = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'pipe' }).toString().trim();
const shio = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });

const wt = path.join(ROOT, '.gh-pages-worktree');
fs.rmSync(wt, { recursive: true, force: true });
try { sh('git worktree prune'); } catch { /* ignore */ }

// Create/checkout an orphan gh-pages branch in a detached worktree
const exists = (() => { try { sh(`git show-ref --verify refs/heads/${BRANCH}`); return true; } catch { return false; } })();
if (exists) shio(`git worktree add "${wt}" ${BRANCH}`);
else {
  shio(`git worktree add --detach "${wt}"`);
  execSync(`git checkout --orphan ${BRANCH}`, { cwd: wt, stdio: 'inherit' });
  execSync('git rm -rf . >/dev/null 2>&1 || true', { cwd: wt, stdio: 'inherit' });
}

// Sync dist/ contents into the worktree
for (const e of fs.readdirSync(wt)) if (e !== '.git') fs.rmSync(path.join(wt, e), { recursive: true, force: true });
for (const e of fs.readdirSync(DIST)) fs.cpSync(path.join(DIST, e), path.join(wt, e), { recursive: true });

execSync('git add -A', { cwd: wt, stdio: 'inherit' });
try {
  execSync('git commit -m "deploy static site to GitHub Pages" ', { cwd: wt, stdio: 'inherit' });
  execSync(`git push -u origin ${BRANCH}`, { cwd: wt, stdio: 'inherit' });
  console.log(`\n✓ Pushed dist/ to '${BRANCH}'. Enable Pages: Settings → Pages → Branch: ${BRANCH} / root.\n`);
} catch {
  console.log('\nNothing to deploy (no changes) or push failed.\n');
}

fs.rmSync(wt, { recursive: true, force: true });
try { sh('git worktree prune'); } catch { /* ignore */ }
