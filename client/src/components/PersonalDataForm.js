/**
 * PERSONAL DATA — split into 3 sections (IDENTITY / CONTACT / EDUCATION) so the
 * form is never too long on one screen. Data is stored in the database on
 * SAVE & CONTINUE; unsaved typing is kept as a local draft while navigating.
 */
import { h } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { field, readFields, showErrors, setLoading, formAlert } from '../ui/form.js';
import { validatePersonal, PERSONAL_SECTIONS, PROVINCES } from '/shared/validators.js';
import { STATUS } from '/shared/status.js';
import { applicantApi } from '../api/services.js';
import { store, setDashboard } from '../core/store.js';
import { navigate } from '../core/router.js';
import { toast } from '../ui/toast.js';
import { ProgressTracker } from './ProgressTracker.js';

const SECTION_META = {
  IDENTITY: { title: 'Identity', ic: 'user', desc: 'Data identitas sesuai KTP / Kartu Keluarga.' },
  CONTACT: { title: 'Contact', ic: 'mail', desc: 'Data kontak yang dapat dihubungi.' },
  EDUCATION: { title: 'Education', ic: 'file', desc: 'Data pendidikan terakhir.' },
};

export function PersonalDataForm(ctx) {
  const { user, dashboard } = store.get();
  const a = dashboard?.applicant || {};
  const draftKey = `nexus.draft.${user.id}`;
  const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null') || {};
  const v = (k, fallback = '') => draft[k] ?? a[k] ?? fallback;
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const fields = {
    name: field({ name: 'name', label: 'Nama Lengkap', icon: 'user', value: v('name', user.name), autocomplete: 'name', maxlength: 100, full: true }),
    nik: field({ name: 'nik', label: 'NIK', icon: 'shield', value: v('nik'), inputmode: 'numeric', maxlength: 16, placeholder: '16 digit NIK', hint: '16-digit national identity number.' }),
    gender: field({ name: 'gender', label: 'Jenis Kelamin', type: 'radio', value: v('gender'), options: [['MALE', 'Male / Laki-laki'], ['FEMALE', 'Female / Perempuan']] }),
    birth_place: field({ name: 'birth_place', label: 'Tempat Lahir', icon: 'home', value: v('birth_place'), placeholder: 'e.g. Bandung', maxlength: 60 }),
    birth_date: field({ name: 'birth_date', label: 'Tanggal Lahir', type: 'date', icon: 'file', value: v('birth_date'), max: today }),
    address: field({ name: 'address', label: 'Alamat', type: 'textarea', icon: 'home', value: v('address'), placeholder: 'Street, number, RT/RW, district', maxlength: 250, full: true }),
    city: field({ name: 'city', label: 'Kota / Kabupaten', icon: 'grid', value: v('city'), placeholder: 'e.g. Bandung', maxlength: 60 }),
    province: field({ name: 'province', label: 'Provinsi', type: 'select', value: v('province'), options: PROVINCES }),
    phone: field({ name: 'phone', label: 'Nomor HP', type: 'tel', icon: 'radio', value: v('phone'), inputmode: 'tel', placeholder: '081234567890', autocomplete: 'tel', maxlength: 16 }),
    email: field({ name: 'email', label: 'Email', type: 'email', icon: 'mail', value: v('email', user.email), inputmode: 'email', autocomplete: 'email' }),
    school: field({ name: 'school', label: 'Asal Sekolah', icon: 'grid', value: v('school'), placeholder: 'e.g. SMA Negeri 1 Bandung', maxlength: 120, full: true }),
    graduation_year: field({
      name: 'graduation_year', label: 'Tahun Lulus', type: 'select', value: v('graduation_year'),
      options: Array.from({ length: 12 }, (_, i) => String(year + 1 - i)),
    }),
  };
  // NIK: digits only while typing
  fields.nik.input.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16); });

  const alert = formAlert();
  let current = 0;
  let saved = false;
  const sectionEls = PERSONAL_SECTIONS.map((s) => {
    const meta = SECTION_META[s.key];
    return h('fieldset', { class: 'form-section', style: { border: 0, padding: 0, margin: 0 } },
      h('legend', { class: 'sr-only' }, meta.title),
      h('div', { class: 'panel-title' }, icon(meta.ic, 18), meta.title),
      h('p', { class: 'muted', style: { marginTop: '-0.6rem' } }, meta.desc),
      h('div', { class: 'form-grid' }, s.fields.map((f) => fields[f])));
  });
  const tabs = PERSONAL_SECTIONS.map((s, i) => h('button', {
    type: 'button', class: 'section-tab', onClick: () => go(i), 'aria-controls': `sec-${s.key}`,
  }, h('span', { class: 'num' }, String(i + 1).padStart(2, '0')), s.key));

  const backBtn = h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => (current ? go(current - 1) : navigate('/dashboard')) });
  const nextBtn = h('button', { type: 'submit', class: 'btn btn-primary' });

  const errorsFor = (i, errs) => PERSONAL_SECTIONS[i].fields.filter((f) => errs[f]);
  const saveDraft = () => sessionStorage.setItem(draftKey, JSON.stringify(readFields(fields)));

  function go(i) {
    current = i;
    sectionEls.forEach((el, j) => { el.hidden = j !== i; el.id = `sec-${PERSONAL_SECTIONS[j].key}`; });
    const errs = validatePersonal(readFields(fields));
    tabs.forEach((t, j) => {
      t.classList.toggle('active', j === i);
      t.setAttribute('aria-selected', String(j === i));
      t.classList.toggle('done', j !== i && j < i && !errorsFor(j, errs).length);
    });
    const last = i === PERSONAL_SECTIONS.length - 1;
    backBtn.replaceChildren(icon('arrowLeft', 16), current ? 'Back' : 'Dashboard');
    nextBtn.replaceChildren(last ? icon('check', 16) : '', last ? 'Save & Continue' : 'Next', last ? '' : icon('arrowRight', 16));
    sectionEls[i].querySelector('input,select,textarea')?.focus({ preventScroll: true });
  }

  async function onSubmit(e) {
    e.preventDefault();
    alert.show('');
    saveDraft();
    const data = readFields(fields);
    const errs = validatePersonal(data);
    const last = current === PERSONAL_SECTIONS.length - 1;

    if (!last) { // validate just this section, then move on
      const sectionErrs = Object.fromEntries(errorsFor(current, errs).map((f) => [f, errs[f]]));
      if (showErrors(fields, sectionErrs)) return;
      return go(current + 1);
    }
    if (Object.keys(errs).length) {
      const bad = PERSONAL_SECTIONS.findIndex((_, i) => errorsFor(i, errs).length);
      tabs[bad].classList.add('error');
      go(bad);
      showErrors(fields, errs);
      alert.show('Some fields need your attention.');
      return;
    }
    const restore = setLoading(nextBtn, 'SAVING');
    try {
      const d = await applicantApi.savePersonal(data);
      saved = true;
      sessionStorage.removeItem(draftKey);
      setDashboard(d);
      toast('Personal data saved.', 'success');
      navigate(d.status === STATUS.PROGRAM_SELECTED ? '/review' : '/programs');
    } catch (err) {
      restore();
      if (err.fields && Object.keys(err.fields).length) {
        const bad = PERSONAL_SECTIONS.findIndex((_, i) => errorsFor(i, err.fields).length);
        if (bad >= 0) go(bad);
        showErrors(fields, err.fields);
      }
      alert.show(err.message);
    }
  }

  ctx.onCleanup(() => { if (!saved) saveDraft(); }); // keep unsaved typing when leaving the page
  tabs.forEach((t) => t.addEventListener('click', () => t.classList.remove('error')));
  go(0);

  return h('div', { class: 'container section' },
    ProgressTracker(dashboard?.status, { compact: true, currentKey: 'PERSONAL' }),
    h('div', { class: 'page-head' },
      h('div', { class: 'eyebrow' }, 'Step 02'),
      h('h2', {}, 'PERSONAL DATA'),
      h('p', {}, 'Isi data diri dengan benar. Data dapat diubah sampai pendaftaran di-submit.')),
    h('form', { class: 'holo-panel', novalidate: true, onSubmit, style: { maxWidth: '900px' } },
      h('div', { class: 'section-tabs', role: 'tablist' }, tabs),
      alert,
      sectionEls,
      h('div', { class: 'form-actions' }, backBtn, nextBtn)));
}
