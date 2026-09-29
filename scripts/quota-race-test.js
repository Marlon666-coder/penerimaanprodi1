/**
 * QUOTA RACE TEST — proves a program can never exceed its capacity.
 *
 * It creates many applicant accounts, fills in their personal data and then
 * makes ALL of them press "SELECT" on the same program at the same moment.
 *
 * Usage (server must be running):
 *   npm run test:quota                      # target Data Science, remaining seats + 10 users
 *   npm run test:quota -- --program IT --users 30
 *   API_URL=http://localhost:3000 npm run test:quota
 */
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
  return acc;
}, []));
const API = process.env.API_URL || 'http://localhost:3000';
const CODE = (args.program || 'DS').toUpperCase();

async function call(path, { method = 'GET', body, token } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

const programs = (await call('/api/programs')).data.programs;
const target = programs.find((p) => p.code === CODE);
if (!target) { console.error(`Program ${CODE} not found`); process.exit(1); }
const users = Number(args.users) || target.remaining + 10;
console.log(`Target: ${target.name}  ${target.applicants}/${target.capacity}  (remaining ${target.remaining})`);
console.log(`Creating ${users} applicants...`);

const stamp = Date.now();
const tokens = [];
for (let i = 0; i < users; i++) {
  const email = `race.${stamp}.${i}@example.com`;
  const reg = await call('/api/auth/register', { method: 'POST', body: { name: `Race Tester ${String.fromCharCode(65 + (i % 26))}`, email, password: 'Race#12345', confirmPassword: 'Race#12345' } });
  if (reg.status !== 201) { console.error('register failed', reg.data); process.exit(1); }
  const nik = String(9000000000000000 + stamp % 1e6 * 100 + i).slice(0, 16);
  const pd = await call('/api/applicants', {
    method: 'POST', token: reg.data.token,
    body: { name: `Race Tester ${String.fromCharCode(65 + (i % 26))}`, nik, birth_place: 'Bandung', birth_date: '2007-05-10', gender: 'MALE',
      address: 'Jl. Pengujian No. 1', city: 'Bandung', province: 'Jawa Barat', phone: '081234567890', email,
      school: 'SMA Negeri 1 Bandung', graduation_year: new Date().getFullYear() },
  });
  if (pd.status !== 200) { console.error('personal data failed', pd.data); process.exit(1); }
  tokens.push(reg.data.token);
}

console.log(`Firing ${users} simultaneous SELECT requests...`);
const results = await Promise.all(tokens.map((token) => call('/api/programs/select', { method: 'POST', token, body: { programId: target.id } })));
const ok = results.filter((r) => r.status === 200).length;
const full = results.filter((r) => r.data?.error?.code === 'PROGRAM_FULL').length;
const other = results.length - ok - full;

const after = (await call('/api/programs')).data.programs.find((p) => p.id === target.id);
console.log(`\nAccepted: ${ok}   Rejected (PROGRAM_FULL): ${full}   Other errors: ${other}`);
console.log(`Final: ${after.name}  ${after.applicants}/${after.capacity}  -> ${after.availability}`);

const pass = after.applicants <= after.capacity && ok === target.remaining && other === 0;
console.log(pass ? '\n✅ PASS — quota was never exceeded.' : '\n❌ FAIL — unexpected result.');
process.exit(pass ? 0 : 1);
