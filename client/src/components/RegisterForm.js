/** CREATE ACCOUNT — validated on the client for instant feedback and again on the server. */
import { h } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { field, readFields, showErrors, setLoading, formAlert } from '../ui/form.js';
import { validateRegister } from '/shared/validators.js';
import { registerAccount } from '../core/store.js';
import { navigate } from '../core/router.js';
import { toast } from '../ui/toast.js';

export function RegisterForm() {
  const fields = {
    name: field({ name: 'name', label: 'Full Name', icon: 'user', placeholder: 'e.g. Hafiz Zikri', autocomplete: 'name', maxlength: 100 }),
    email: field({ name: 'email', label: 'Email', type: 'email', icon: 'mail', placeholder: 'you@example.com', autocomplete: 'email', inputmode: 'email' }),
    password: field({ name: 'password', label: 'Password', type: 'password', icon: 'lock', placeholder: 'Minimum 8 characters', autocomplete: 'new-password', hint: 'At least 8 characters.' }),
    confirmPassword: field({ name: 'confirmPassword', label: 'Confirm Password', type: 'password', icon: 'key', placeholder: 'Repeat password', autocomplete: 'new-password' }),
  };
  const alert = formAlert();
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, icon('sparkles', 18), 'Create Account');
  let card;

  async function onSubmit(e) {
    e.preventDefault();
    alert.show('');
    const data = readFields(fields);
    if (showErrors(fields, validateRegister(data))) return;
    const restore = setLoading(btn, 'CREATING ACCOUNT');
    try {
      const user = await registerAccount({ ...data, name: data.name.trim(), email: data.email.trim() });
      card.classList.add('granted');
      btn.replaceChildren(icon('check', 18), h('span', {}, 'ACCOUNT CREATED'));
      alert.show('ACCOUNT CREATED SUCCESSFULLY — redirecting to your dashboard…', 'success');
      toast(`Welcome to NEXUS, ${user.name}!`, 'success');
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err) {
      restore();
      showErrors(fields, err.fields);
      alert.show(err.message);
    }
  }

  card = h('div', { class: 'holo-panel auth-card scan' },
    h('div', { class: 'auth-head' },
      h('div', { class: 'auth-icon' }, icon('user', 30)),
      h('div', { class: 'eyebrow' }, 'New Applicant'),
      h('h2', {}, 'CREATE YOUR ACCOUNT'),
      h('p', {}, 'Step 01 of your journey to the future.')),
    h('form', { class: 'form', novalidate: true, onSubmit }, alert, fields.name, fields.email, fields.password, fields.confirmPassword, btn),
    h('p', { class: 'auth-foot' }, 'Already have an account? ', h('a', { href: '#/login' }, h('b', {}, 'SIGN IN'))));

  return h('section', { class: 'container auth-wrap' }, card);
}
