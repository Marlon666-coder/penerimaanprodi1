/**
 * Shared validation rules (used by the browser for instant feedback AND by
 * the server, which re-validates everything — never trust the client).
 * Each validator returns an object { field: 'error message' }; empty = valid.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function validateRegister({ name, email, password, confirmPassword } = {}) {
  const e = {};
  if (!str(name)) e.name = 'Full name is required';
  else if (str(name).length < 3) e.name = 'Name must be at least 3 characters';
  else if (str(name).length > 100) e.name = 'Name is too long';
  if (!str(email)) e.email = 'Email is required';
  else if (!EMAIL_RE.test(str(email))) e.email = 'Email format is invalid';
  if (!password) e.password = 'Password is required';
  else if (String(password).length < 8) e.password = 'Password must be at least 8 characters';
  if (!confirmPassword) e.confirmPassword = 'Please confirm your password';
  else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
  return e;
}

export function validateLogin({ email, password } = {}) {
  const e = {};
  if (!str(email)) e.email = 'Email is required';
  else if (!EMAIL_RE.test(str(email))) e.email = 'Email format is invalid';
  if (!password) e.password = 'Password is required';
  return e;
}

export function validatePasswordReset({ token, password, confirmPassword } = {}) {
  const e = {};
  if (!str(token)) e.token = 'Reset code is required';
  if (!password) e.password = 'Password is required';
  else if (String(password).length < 8) e.password = 'Password must be at least 8 characters';
  if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
  return e;
}

/** Field groups of the personal data form (also used to build the UI sections). */
export const PERSONAL_SECTIONS = [
  { key: 'IDENTITY', fields: ['name', 'nik', 'birth_place', 'birth_date', 'gender'] },
  { key: 'CONTACT', fields: ['address', 'city', 'province', 'phone', 'email'] },
  { key: 'EDUCATION', fields: ['school', 'graduation_year'] },
];

export const PERSONAL_FIELDS = PERSONAL_SECTIONS.flatMap((s) => s.fields);

/**
 * Personal data validation.
 * @param {object} d form data
 * @param {Date} now injectable "today" (for tests)
 */
export function validatePersonal(d = {}, now = new Date()) {
  const e = {};
  const currentYear = now.getFullYear();

  if (!str(d.name)) e.name = 'Full name is required';
  else if (!/^[\p{L} .'-]{3,100}$/u.test(str(d.name))) e.name = 'Use letters only (3–100 characters)';

  if (!str(d.nik)) e.nik = 'NIK is required';
  else if (!/^\d{16}$/.test(str(d.nik))) e.nik = 'NIK must be exactly 16 digits';

  if (!str(d.birth_place)) e.birth_place = 'Place of birth is required';
  else if (str(d.birth_place).length > 60) e.birth_place = 'Too long';

  if (!str(d.birth_date)) e.birth_date = 'Date of birth is required';
  else {
    const bd = new Date(`${str(d.birth_date)}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str(d.birth_date)) || Number.isNaN(bd.getTime())) {
      e.birth_date = 'Invalid date';
    } else {
      let age = currentYear - bd.getFullYear();
      const m = now.getMonth() - bd.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
      if (age < 14 || age > 60) e.birth_date = 'Applicant age must be between 14 and 60 years';
    }
  }

  if (!['MALE', 'FEMALE'].includes(d.gender)) e.gender = 'Please select a gender';

  if (!str(d.address)) e.address = 'Address is required';
  else if (str(d.address).length < 10) e.address = 'Address must be at least 10 characters';
  else if (str(d.address).length > 250) e.address = 'Address is too long';

  if (!str(d.city)) e.city = 'City is required';
  if (!str(d.province)) e.province = 'Province is required';

  const phone = str(d.phone).replace(/[\s-]/g, '');
  if (!phone) e.phone = 'Phone number is required';
  else if (!/^(\+62|62|0)8\d{7,12}$/.test(phone)) e.phone = 'Use an Indonesian mobile number, e.g. 081234567890';

  if (!str(d.email)) e.email = 'Email is required';
  else if (!EMAIL_RE.test(str(d.email))) e.email = 'Email format is invalid';

  if (!str(d.school)) e.school = 'School of origin is required';
  else if (str(d.school).length > 120) e.school = 'Too long';

  const gy = Number(d.graduation_year);
  if (!str(String(d.graduation_year ?? ''))) e.graduation_year = 'Graduation year is required';
  else if (!Number.isInteger(gy) || gy < currentYear - 10 || gy > currentYear + 1) {
    e.graduation_year = `Year must be between ${currentYear - 10} and ${currentYear + 1}`;
  }
  return e;
}

/** Indonesian provinces for the select input. */
export const PROVINCES = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Sumatera Selatan',
  'Kepulauan Bangka Belitung', 'Bengkulu', 'Lampung', 'DKI Jakarta', 'Jawa Barat', 'Banten', 'Jawa Tengah',
  'DI Yogyakarta', 'Jawa Timur', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat',
  'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara', 'Sulawesi Utara',
  'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Maluku',
  'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan',
];
