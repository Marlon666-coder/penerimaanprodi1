/**
 * Forgot Password — two steps:
 *  1. request a reset code (sent by email when the server has an email provider)
 *  2. enter the code + new password
 * In DEMO mode without email, the server returns the code so the flow is testable;
 * this is shown clearly as a demo message (never happens in production).
 */
import { h, mount } from '../core/h.js';
import { icon } from '../ui/icons.js';
import { field, readFields, showErrors, setLoading, formAlert } from '../ui/form.js';
import { EMAIL_RE, validatePasswordReset } from '/shared/validators.js';
import { authApi } from '../api/services.js';
import { navigate } from '../core/router.js';
import { toast } from '../ui/toast.js';

export function ForgotPasswordForm() {
  const body = h('div');
  let email = '';

  function stepRequest() {
    const f = { email: field({ name: 'email', label: 'Account Email', type: 'email', icon: 'mail', placeholder: 'you@example.com', autocomplete: 'email', inputmode: 'email', value: email }) };
    const alert = formAlert();
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, icon('mail', 18), 'Send Reset Code');
    mount(body, h('form', {
      class: 'form', novalidate: true,
      onSubmit: async (e) => {
        e.preventDefault();
        email = f.email.input.value.trim();
        if (showErrors(f, EMAIL_RE.test(email) ? {} : { email: 'Enter a valid email' })) return;
        const restore = setLoading(btn, 'SENDING');
        try {
          const r = await authApi.forgotPassword(email);
          stepReset(r);
        } catch (err) {
          restore();
          alert.show(err.message);
        }
      },
    }, alert, f.email, btn));
  }

  function stepReset(resp) {
    const f = {
      token: field({ name: 'token', label: 'Reset Code', icon: 'key', placeholder: 'XXXX-XXXX', value: resp.demoCode || '', maxlength: 9 }),
      password: field({ name: 'password', label: 'New Password', type: 'password', icon: 'lock', placeholder: 'Minimum 8 characters', autocomplete: 'new-password' }),
      confirmPassword: field({ name: 'confirmPassword', label: 'Confirm New Password', type: 'password', icon: 'key', autocomplete: 'new-password' }),
    };
    const info = formAlert();
    info.show(resp.delivery === 'EMAIL'
      ? `If ${email} is registered, a reset code has been sent to it. It expires in 15 minutes.`
      : resp.demoCode
        ? `DEMO MODE: email delivery is not configured, so the code is shown here and pre-filled: ${resp.demoCode}`
        : `DEMO MODE: no account found for ${email}. Check the address or register a new account.`, resp.demoCode || resp.delivery === 'EMAIL' ? 'info' : 'warn');
    const alert = formAlert();
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, icon('check', 18), 'Update Password');
    mount(body, h('form', {
      class: 'form', novalidate: true,
      onSubmit: async (e) => {
        e.preventDefault();
        alert.show('');
        const data = readFields(f);
        if (showErrors(f, validatePasswordReset(data))) return;
        const restore = setLoading(btn, 'UPDATING');
        try {
          await authApi.resetPassword({ ...data, email });
          toast('Password updated. Please sign in with your new password.', 'success');
          navigate('/login');
        } catch (err) {
          restore();
          showErrors(f, err.fields);
          alert.show(err.message);
        }
      },
    }, info, alert, f.token, f.password, f.confirmPassword, btn,
    h('button', { type: 'button', class: 'link-btn', onClick: stepRequest }, '← Use a different email')));
  }

  stepRequest();
  return h('section', { class: 'container auth-wrap' },
    h('div', { class: 'holo-panel auth-card scan' },
      h('div', { class: 'auth-head' },
        h('div', { class: 'auth-icon' }, icon('key', 30)),
        h('div', { class: 'eyebrow' }, 'Account Recovery'),
        h('h2', {}, 'RESET PASSWORD'),
        h('p', {}, 'We will issue a one-time code to reset your password.')),
      body,
      h('p', { class: 'auth-foot' }, 'Remembered it? ', h('a', { href: '#/login' }, h('b', {}, 'SIGN IN')))));
}
