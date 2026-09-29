/**
 * Authentication business logic: register, login, password reset.
 */
import { ApiError } from '../lib/http.js';
import { hashPassword, verifyPassword, signToken, DUMMY_HASH, sha256, randomCode, createRateLimiter } from '../lib/security.js';
import { userRepository, publicUser } from '../repositories/userRepository.js';
import { validateRegister, validateLogin, validatePasswordReset, EMAIL_RE } from '../../shared/validators.js';
import { sendPasswordResetCode, isEmailConfigured } from './emailService.js';
import { config } from '../config.js';

const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const resetLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
export const clearAuthLimits = () => { loginLimiter.clear(); resetLimiter.clear(); };

const RESET_TTL_MS = 15 * 60 * 1000;

function issue(user) {
  return { token: signToken({ sub: user.id, role: user.role }), user: publicUser(user) };
}

export const authService = {
  register(body) {
    const errors = validateRegister(body);
    if (Object.keys(errors).length) throw new ApiError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields', errors);
    if (userRepository.findByEmail(body.email)) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists', { email: 'Email is already registered' });
    }
    const user = userRepository.create({ name: body.name, email: body.email, passwordHash: hashPassword(body.password) });
    return issue(user);
  },

  login(body, ip) {
    const errors = validateLogin(body);
    if (Object.keys(errors).length) throw new ApiError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields', errors);
    const key = `${ip}|${String(body.email).toLowerCase()}`;
    if (!loginLimiter.hit(key)) throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many login attempts. Try again in 15 minutes.');
    const user = userRepository.findByEmail(body.email);
    // Always run the hash so response time does not reveal whether the email exists
    const ok = verifyPassword(body.password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    loginLimiter.reset(key);
    return issue(user);
  },

  /**
   * Step 1: generate a one-time code. It is sent by email when an email
   * provider is configured. In DEMO mode without email, the code is returned
   * to the browser (clearly labelled) so the flow can still be tested.
   */
  async forgotPassword(body, ip) {
    const email = String(body.email ?? '').trim();
    if (!EMAIL_RE.test(email)) throw new ApiError(422, 'VALIDATION_ERROR', 'Enter a valid email', { email: 'Email format is invalid' });
    if (!resetLimiter.hit(`${ip}|${email.toLowerCase()}`)) throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many requests. Try again later.');

    const emailReady = isEmailConfigured();
    if (!emailReady && !config.demoMode) {
      throw new ApiError(503, 'EMAIL_NOT_CONFIGURED', 'Password reset by email is not available. Contact the administrator.');
    }
    const generic = { message: 'If the email is registered, a reset code has been issued.', delivery: emailReady ? 'EMAIL' : 'DEMO' };
    const user = userRepository.findByEmail(email);
    if (!user) return generic; // do not reveal which emails exist

    const code = randomCode();
    userRepository.saveResetCode(user.id, sha256(code), Date.now() + RESET_TTL_MS);
    if (emailReady) {
      const r = await sendPasswordResetCode(user, code);
      if (r.status !== 'SENT') throw new ApiError(502, 'EMAIL_FAILED', 'Could not send the reset email. Try again later.');
      return generic;
    }
    return { ...generic, demoCode: code };
  },

  /** Step 2: verify code + set the new password. */
  resetPassword(body) {
    const errors = validatePasswordReset(body);
    if (!EMAIL_RE.test(String(body.email ?? '').trim())) errors.email = 'Email format is invalid';
    if (Object.keys(errors).length) throw new ApiError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields', errors);
    const invalid = new ApiError(400, 'INVALID_RESET_CODE', 'The reset code is invalid or has expired', { token: 'Invalid or expired code' });
    const user = userRepository.findByEmail(body.email);
    if (!user) throw invalid;
    const rec = userRepository.getResetCode(user.id);
    if (!rec || rec.expires_at < Date.now() || rec.attempts >= 5) throw invalid;
    if (rec.code_hash !== sha256(String(body.token).trim().toUpperCase())) {
      userRepository.bumpResetAttempts(user.id);
      throw invalid;
    }
    userRepository.updatePassword(user.id, hashPassword(body.password));
    userRepository.deleteResetCode(user.id);
    return { message: 'Password updated. You can sign in now.' };
  },
};
