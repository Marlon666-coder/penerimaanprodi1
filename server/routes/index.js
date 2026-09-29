/**
 * REST API (all JSON, prefix /api)
 *
 *  POST /api/auth/register            create account
 *  POST /api/auth/login               sign in -> token
 *  GET  /api/auth/me                  current user
 *  POST /api/auth/forgot-password     issue reset code
 *  POST /api/auth/reset-password      set new password with code
 *
 *  GET  /api/programs                 programs + live quota
 *  GET  /api/stats                    landing page statistics
 *  GET  /api/stream                   realtime quota updates (Server-Sent Events)
 *  GET  /api/config                   public UI settings (demo mode, email configured)
 *  POST /api/programs/select          reserve a seat          (auth)
 *  POST /api/programs/release         give the seat back      (auth)
 *
 *  GET  /api/dashboard                user dashboard          (auth)
 *  POST /api/applicants               save personal data      (auth)
 *  POST /api/applications/submit      final submission        (auth)
 *  GET  /api/applications/receipt     HTML receipt            (auth)
 *
 *  GET  /api/admin/overview           statistics              (admin)
 *  GET  /api/applicants               list/search/filter      (admin)
 *  GET  /api/applicants/:id           applicant detail        (admin)
 *  POST /api/admin/reset              reset demo data         (admin + DEMO_MODE)
 */
import { Router, ApiError } from '../lib/http.js';
import { verifyToken } from '../lib/security.js';
import { userRepository } from '../repositories/userRepository.js';
import { authService } from '../services/authService.js';
import { applicationService } from '../services/applicationService.js';
import { adminService } from '../services/adminService.js';
import { publicSnapshot, subscribe } from '../services/eventService.js';
import { publicUser } from '../repositories/userRepository.js';
import { isEmailConfigured } from '../services/emailService.js';
import { config } from '../config.js';

export const router = new Router();

// ---------- middleware ----------
function requireAuth(ctx) {
  const header = ctx.req.headers.authorization || '';
  const payload = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
  const user = payload && userRepository.findById(payload.sub);
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.');
  ctx.user = user;
}
function requireAdmin(ctx) {
  requireAuth(ctx);
  if (ctx.user.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Administrator access required');
}
function requireApplicant(ctx) {
  requireAuth(ctx);
  if (ctx.user.role !== 'applicant') throw new ApiError(403, 'FORBIDDEN', 'Admin accounts cannot submit applications');
}

// ---------- auth ----------
router.post('/api/auth/register', (ctx) => [201, authService.register(ctx.body)]);
router.post('/api/auth/login', (ctx) => authService.login(ctx.body, ctx.ip));
router.get('/api/auth/me', requireAuth, (ctx) => ({ user: publicUser(ctx.user) }));
router.post('/api/auth/forgot-password', (ctx) => authService.forgotPassword(ctx.body, ctx.ip));
router.post('/api/auth/reset-password', (ctx) => authService.resetPassword(ctx.body));

// ---------- public ----------
router.get('/api/programs', () => ({ programs: publicSnapshot().programs }));
router.get('/api/stats', () => publicSnapshot().stats);
router.get('/api/stream', (ctx) => { subscribe(ctx.req, ctx.res); return undefined; });
router.get('/api/health', () => ({ ok: true, time: new Date().toISOString() }));
// Public, non-secret settings the UI needs (never expose credentials here)
router.get('/api/config', () => ({
  demoMode: config.demoMode,
  emailConfigured: isEmailConfigured(),
  registrationOpen: config.registrationOpen,
  admissionYear: config.admissionYear,
}));

// ---------- applicant ----------
router.get('/api/dashboard', requireApplicant, (ctx) => applicationService.dashboard(ctx.user));
router.post('/api/applicants', requireApplicant, (ctx) => applicationService.savePersonal(ctx.user, ctx.body));
router.post('/api/programs/select', requireApplicant, (ctx) => applicationService.selectProgram(ctx.user, ctx.body.programId));
router.post('/api/programs/release', requireApplicant, (ctx) => applicationService.releaseProgram(ctx.user));
router.post('/api/applications/submit', requireApplicant, (ctx) => applicationService.submit(ctx.user, ctx.body));
router.get('/api/applications/receipt', requireApplicant, (ctx) => {
  const html = applicationService.receiptHtml(ctx.user);
  ctx.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  ctx.res.end(html);
  return undefined;
});

// ---------- admin ----------
router.get('/api/admin/overview', requireAdmin, () => adminService.overview());
router.get('/api/applicants', requireAdmin, (ctx) => adminService.listApplicants(ctx.query));
router.get('/api/applicants/:id', requireAdmin, (ctx) => adminService.applicantDetail(ctx.params.id));
router.post('/api/admin/reset', requireAdmin, (ctx) => adminService.reset(ctx.body.mode));
