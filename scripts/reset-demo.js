/**
 * CLI: restore the demo database to its default state.
 *   npm run reset
 * (Stop the server first or restart it afterwards is NOT needed — SQLite handles it,
 *  but open browser sessions of deleted users will be logged out.)
 */
import { initData, resetDemoData } from '../server/db/seed.js';

initData();
const r = resetDemoData();
console.log(`Demo data restored: ${r.dummyApplicants} dummy applicants, all applicant accounts removed (admin kept).`);
