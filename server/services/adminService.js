/**
 * Admin-only features: statistics, applicant search/detail, demo reset.
 */
import { ApiError } from '../lib/http.js';
import { applicantRepository } from '../repositories/applicantRepository.js';
import { publicSnapshot, broadcastSnapshot } from './eventService.js';
import { resetDemoData, removeDummyData } from '../db/seed.js';
import { clearAuthLimits } from './authService.js';
import { STATUS } from '../../shared/status.js';
import { config } from '../config.js';

const STATUSES = [STATUS.DATA_COMPLETED, STATUS.PROGRAM_SELECTED, STATUS.SUBMITTED];

export const adminService = {
  overview() {
    const snap = publicSnapshot();
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of applicantRepository.countByStatus()) byStatus[r.status] = Number(r.n);
    return {
      ...snap,
      stats: { ...snap.stats, totalRecords: applicantRepository.countAll() },
      byStatus,
      demoMode: config.demoMode,
    };
  },

  listApplicants(query) {
    const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 20));
    const page = Math.max(1, Number(query.get('page')) || 1);
    const status = query.get('status') || '';
    if (status && !STATUSES.includes(status)) throw new ApiError(422, 'VALIDATION_ERROR', 'Unknown status filter');
    const { total, rows } = applicantRepository.search({
      q: (query.get('q') || '').trim().slice(0, 100),
      programId: Number(query.get('program')) || null,
      status,
      limit,
      offset: (page - 1) * limit,
    });
    return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), rows };
  },

  applicantDetail(id) {
    const a = applicantRepository.findById(Number(id));
    if (!a) throw new ApiError(404, 'NOT_FOUND', 'Applicant not found');
    return a;
  },

  reset(mode) {
    if (!config.demoMode) throw new ApiError(403, 'DEMO_DISABLED', 'Demo tools are disabled (DEMO_MODE=false)');
    let result;
    if (mode === 'demo') result = resetDemoData();
    else if (mode === 'dummies') result = removeDummyData();
    else throw new ApiError(422, 'VALIDATION_ERROR', 'mode must be "demo" or "dummies"');
    clearAuthLimits();
    broadcastSnapshot();
    return { ok: true, mode, ...result };
  },
};
