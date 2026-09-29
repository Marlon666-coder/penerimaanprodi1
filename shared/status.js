/**
 * Shared constants & quota rules.
 * This file is imported by BOTH the server (Node) and the browser (ES module),
 * so the business rules stay identical on both sides.
 * NOTE: the server is always the source of truth — the browser only uses
 * these helpers for display, never for the final decision.
 */

/** Application status lifecycle (one application per account). */
export const STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED', // account exists, no personal data yet (no applicant row)
  DATA_COMPLETED: 'DATA_COMPLETED', // personal data saved
  PROGRAM_SELECTED: 'PROGRAM_SELECTED', // a seat is reserved in a program
  SUBMITTED: 'SUBMITTED', // final, locked, has a registration number
});

/**
 * Statuses that OCCUPY a seat in a program.
 * A seat is reserved the moment a user selects a program (applicants + 1),
 * so a user who is reviewing the application can always submit it.
 */
export const SEAT_STATUSES = Object.freeze([STATUS.PROGRAM_SELECTED, STATUS.SUBMITTED]);

/** "Almost full" threshold: 90% or more of capacity. */
export const ALMOST_FULL_RATIO = 0.9;

/**
 * QUOTA RULE (display version)
 *   IF applicants >= capacity  -> FULL   (select button disabled)
 *   ELSE IF >= 90% of capacity -> ALMOST_FULL
 *   ELSE                       -> AVAILABLE
 */
export function programAvailability(applicants, capacity) {
  if (applicants >= capacity) return 'FULL';
  if (capacity > 0 && applicants / capacity >= ALMOST_FULL_RATIO) return 'ALMOST_FULL';
  return 'AVAILABLE';
}

/** Progress tracker steps used by the dashboard & stepper. */
export const STEPS = Object.freeze([
  { key: 'ACCOUNT', label: 'Account' },
  { key: 'PERSONAL', label: 'Personal Data' },
  { key: 'PROGRAM', label: 'Program Selection' },
  { key: 'CONFIRM', label: 'Confirmation' },
  { key: 'SUBMITTED', label: 'Submitted' },
]);

/** How many steps are complete for a status (account is always complete). */
export function completedSteps(status) {
  switch (status) {
    case STATUS.DATA_COMPLETED: return 2;
    case STATUS.PROGRAM_SELECTED: return 3;
    case STATUS.SUBMITTED: return 5;
    default: return 1;
  }
}
