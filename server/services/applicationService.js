/**
 * Application workflow: personal data -> program selection (seat reservation)
 * -> confirmation -> submission. Every rule is enforced HERE on the server.
 *
 *  ACCOUNT ─▶ PERSONAL DATA ─▶ PROGRAM SELECTED ─▶ SUBMITTED (locked)
 *               (DATA_COMPLETED)   (seat reserved)
 */
import { ApiError } from '../lib/http.js';
import { transaction } from '../db/database.js';
import { applicantRepository } from '../repositories/applicantRepository.js';
import { programRepository } from '../repositories/programRepository.js';
import { validatePersonal, PERSONAL_FIELDS } from '../../shared/validators.js';
import { STATUS, completedSteps } from '../../shared/status.js';
import { sendApplicationConfirmation, EMAIL_STATUS } from './emailService.js';
import { broadcastSnapshot } from './eventService.js';
import { publicUser } from '../repositories/userRepository.js';
import { config } from '../config.js';

const locked = () => new ApiError(409, 'APPLICATION_LOCKED', 'Your application has already been submitted and can no longer be changed.');

function normalizePersonal(body) {
  const d = {};
  for (const f of PERSONAL_FIELDS) d[f] = typeof body[f] === 'string' ? body[f].trim() : body[f];
  d.phone = String(d.phone ?? '').replace(/[\s-]/g, '');
  d.email = String(d.email ?? '').toLowerCase();
  d.graduation_year = Number(d.graduation_year);
  return d;
}

export function formatRegistrationNumber(year, seq) {
  return `NX-${year}-${String(seq).padStart(6, '0')}`;
}

export const applicationService = {
  /** Everything the user dashboard needs in one call. */
  dashboard(user) {
    const applicant = applicantRepository.findByUserId(user.id);
    const status = applicant?.status ?? STATUS.NOT_STARTED;
    const program = applicant?.selected_program ? programRepository.findById(applicant.selected_program) : null;
    return { user: publicUser(user), applicant, program, status, completedSteps: completedSteps(status) };
  },

  savePersonal(user, body) {
    const current = applicantRepository.findByUserId(user.id);
    if (current?.status === STATUS.SUBMITTED) throw locked();
    const data = normalizePersonal(body);
    const errors = validatePersonal(data);
    if (Object.keys(errors).length) throw new ApiError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields', errors);
    if (applicantRepository.nikTakenBySubmitted(data.nik, current?.id)) {
      throw new ApiError(409, 'NIK_REGISTERED', 'This NIK is already used by a submitted application', { nik: 'NIK already registered' });
    }
    applicantRepository.savePersonal(user.id, data);
    return this.dashboard(user);
  },

  /**
   * ===== QUOTA SYSTEM — SELECT A PROGRAM =====
   * Runs inside a write transaction. The seat is only reserved when
   * (seats taken by OTHER applicants) < capacity. If two users click SELECT
   * on the last seat at the same moment, the transactions run one after the
   * other: the first gets 50/50, the second receives PROGRAM_FULL.
   */
  selectProgram(user, programId) {
    const id = Number(programId);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid program');
    if (!config.registrationOpen) throw new ApiError(403, 'REGISTRATION_CLOSED', 'Registration is currently closed');

    const result = transaction(() => {
      const applicant = applicantRepository.findByUserId(user.id);
      if (!applicant) throw new ApiError(409, 'PERSONAL_DATA_REQUIRED', 'Complete your personal data before choosing a program.');
      if (applicant.status === STATUS.SUBMITTED) throw locked();

      const program = programRepository.findById(id);
      if (!program || !program.active) throw new ApiError(404, 'PROGRAM_NOT_FOUND', 'Program not found');
      if (applicant.selected_program === id) return { changed: false }; // already holding this seat

      let reserved = false;
      try {
        reserved = applicantRepository.reserveSeat(applicant.id, id);
      } catch (err) {
        if (!String(err.message).includes('PROGRAM_FULL')) throw err; // DB trigger fired
      }
      if (!reserved) {
        throw new ApiError(409, 'PROGRAM_FULL', `${program.name} is FULL (${program.applicants}/${program.capacity}). Please choose another program.`);
      }
      return { changed: true };
    });
    if (result.changed) broadcastSnapshot();
    return this.dashboard(user);
  },

  /** Give back the reserved seat so the user can pick another program (before submission only). */
  releaseProgram(user) {
    const applicant = applicantRepository.findByUserId(user.id);
    if (!applicant) throw new ApiError(409, 'PERSONAL_DATA_REQUIRED', 'No application found');
    if (applicant.status === STATUS.SUBMITTED) throw locked();
    if (applicantRepository.releaseSeat(applicant.id)) broadcastSnapshot();
    return this.dashboard(user);
  },

  /** Final submission: generates the registration number and locks the application. */
  async submit(user, body) {
    if (body.confirm !== true) {
      throw new ApiError(422, 'CONFIRMATION_REQUIRED', 'You must confirm that the information is correct', { confirm: 'Required' });
    }
    const applicantId = transaction(() => {
      const applicant = applicantRepository.findByUserId(user.id);
      if (!applicant) throw new ApiError(409, 'PERSONAL_DATA_REQUIRED', 'Complete your personal data first.');
      if (applicant.status === STATUS.SUBMITTED) {
        throw new ApiError(409, 'ALREADY_SUBMITTED', 'This account has already submitted an application.');
      }
      if (applicant.status !== STATUS.PROGRAM_SELECTED || !applicant.selected_program) {
        throw new ApiError(409, 'PROGRAM_REQUIRED', 'Select a study program before submitting.');
      }
      // Re-validate stored data (never trust earlier steps blindly)
      const errors = validatePersonal(applicant);
      if (Object.keys(errors).length) throw new ApiError(422, 'VALIDATION_ERROR', 'Your personal data is incomplete', errors);
      if (applicantRepository.nikTakenBySubmitted(applicant.nik, applicant.id)) {
        throw new ApiError(409, 'NIK_REGISTERED', 'This NIK is already used by another submitted application');
      }
      const seq = applicantRepository.nextSequence(`registration_${config.admissionYear}`);
      const regNo = formatRegistrationNumber(config.admissionYear, seq);
      if (!applicantRepository.submit(applicant.id, regNo)) throw new ApiError(409, 'SUBMIT_FAILED', 'Submission failed, please retry');
      return applicant.id;
    });
    broadcastSnapshot();

    // Email notification (after commit; failure never undoes the submission)
    const app = applicantRepository.findById(applicantId);
    const email = await sendApplicationConfirmation(app);
    applicantRepository.setEmailStatus(applicantId, email.status);
    return { ...this.dashboard(user), email: { status: email.status ?? EMAIL_STATUS.NOT_CONFIGURED } };
  },

  /** Printable HTML receipt generated from database data. */
  receiptHtml(user) {
    const a = applicantRepository.findByUserId(user.id);
    if (!a || a.status !== STATUS.SUBMITTED) throw new ApiError(409, 'NOT_SUBMITTED', 'A receipt is only available after submission.');
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const date = new Date(a.registration_date).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
    const rows = [
      ['Registration ID', a.registration_number], ['Name', a.name], ['NIK', a.nik],
      ['Place / Date of Birth', `${a.birth_place}, ${a.birth_date}`], ['Gender', a.gender],
      ['Address', `${a.address}, ${a.city}, ${a.province}`], ['Phone', a.phone], ['Email', a.email],
      ['School', `${a.school} (${a.graduation_year})`], ['Program', a.program_name], ['Status', a.status],
      ['Registration Date', date],
    ];
    return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(a.registration_number)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;background:#050816;color:#F8FAFC;padding:40px}
.card{max-width:720px;margin:auto;border:1px solid #00F5FF55;border-radius:16px;padding:32px;background:#0b1026}
h1{color:#00F5FF;letter-spacing:4px;margin:0}h2{color:#8B5CF6;font-size:14px;letter-spacing:3px}
td{padding:8px 12px;border-bottom:1px solid #ffffff14;vertical-align:top}td:first-child{color:#94a3b8;width:40%}
.id{font-size:26px;font-weight:bold;letter-spacing:3px;color:#00F5FF;margin:16px 0}
.note{color:#94a3b8;font-size:12px;margin-top:24px}
@media print{body{background:#fff;color:#000}.card{background:#fff;border-color:#000}td:first-child,.note{color:#333}h1,.id{color:#000}}</style>
</head><body><div class="card"><h1>NEXUS ADMISSION</h1><h2>REGISTRATION RECEIPT</h2>
<div class="id">${esc(a.registration_number)}</div><table>
${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}
</table><p class="note">Generated ${esc(new Date().toLocaleString('en-GB'))}. Keep this receipt as proof of registration. Use your browser's Print → Save as PDF to store it as PDF.</p>
</div></body></html>`;
  },
};
