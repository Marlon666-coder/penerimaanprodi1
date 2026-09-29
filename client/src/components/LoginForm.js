/** WELCOME BACK, APPLICANT — sign in. Admins use the same form and are redirected to /admin. */
import { h } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { field, readFields, showErrors, setLoading, formAlert } from '../ui/form.js';
import { validateLogin } from '/shared/validators.js';
import { login, store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { toast } from '../ui/toast.js';

export function LoginForm() {
  const fields = {
    email: field({ name: 'email', label: 'Email', type: 'email', icon: 'mail', placeholder: 'you@example.com', autocomplete: 'email', inputmode: 'email' }),
    password: field({ name: 'password', label: 'Password', type: 'password', icon: 'lock', placeholder: '••••••••', autocomplete: 'current-password' }),
  };
  const alert = formAlert();
  const submitBtn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, icon('login', 18), 'Sign In');
  let card;

  async function onSubmit(e) {
    e.preventDefault();
    alert.show('');
    const data = readFields(fields);
    if (showErrors(fields, validateLogin(data))) return;
    const restore = setLoading(submitBtn, 'AUTHENTICATING');
    card.classList.add('authorizing');
    try {
      const user = await login(data.email.trim(), data.password);
      card.classList.replace('authorizing', 'granted');
      submitBtn.replaceChildren(icon('check', 18), h('span', {}, 'ACCESS GRANTED'));
      toast(`Welcome back, ${user.name}!`, 'success');
      setTimeout(() => navigate(user.role === 'admin' ? '/admin' : '/dashboard'), 450);
    } catch (err) {
      restore();
      card.classList.remove('authorizing');
      showErrors(fields, err.fields);
      alert.show(err.code === 'INVALID_CREDENTIALS' ? 'ACCESS DENIED — invalid email or password.' : err.message);
      card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    }
  }

  const fill = (email, pw) => { fields.email.input.value = email; fields.password.input.value = pw; };

  card = h('div', { class: 'holo-panel auth-card scan' },
    h('div', { class: 'auth-head' },
      h('div', { class: 'auth-icon' }, icon('shield', 30)),
      h('div', { class: 'eyebrow' }, 'Secure Access'),
      h('h2', {}, 'WELCOME BACK, APPLICANT'),
      h('p', {}, 'Sign in to continue your application.')),
    h('form', { class: 'form', novalidate: true, onSubmit },
      alert, fields.email, fields.password,
      h('div', { class: 'auth-links' }, h('a', { href: '#/forgot' }, 'Forgot Password?')),
      submitBtn),
    h('p', { class: 'auth-foot' }, "Don't have an account? ", h('a', { href: '#/register' }, h('b', {}, 'REGISTER'))),
    !store.get().config.demoMode ? null : h('div', { class: 'demo-hint' },
      h('div', {}, 'Demo accounts (development mode):'),
      h('div', { class: 'row', style: { marginTop: '0.4rem' } },
        h('button', { type: 'button', class: 'btn btn-sm', onClick: () => fill('demo@nexus.ac.id', 'Demo#2026') }, icon('user', 14), 'Applicant'),
        h('button', { type: 'button', class: 'btn btn-sm btn-purple', onClick: () => fill('admin@nexus.ac.id', 'Admin#2026') }, icon('shield', 14), 'Admin'))));

  return h('section', { class: 'container auth-wrap' }, card);
}
