/**
 * Route table + FLOW GUARDS (UX rules):
 *  - no personal data  -> cannot open program selection review
 *  - no program chosen -> cannot open the review / submit page
 *  - already submitted -> cannot edit data or register again
 * The server enforces the same rules; these guards only improve UX.
 */
import { STATUS } from '/shared/status.js';
import { h } from './core/h.js';
import { LandingPage } from './components/LandingPage.js';
import { LoginForm } from './components/LoginForm.js';
import { RegisterForm } from './components/RegisterForm.js';
import { ForgotPasswordForm } from './components/ForgotPasswordForm.js';
import { Dashboard } from './components/Dashboard.js';
import { PersonalDataForm } from './components/PersonalDataForm.js';
import { ProgramList } from './components/ProgramList.js';
import { ApplicationReview } from './components/ApplicationReview.js';
import { SuccessScreen } from './components/SuccessScreen.js';
import { AdminDashboard } from './components/AdminDashboard.js';

const status = (s) => s.dashboard?.status ?? STATUS.NOT_STARTED;

export const routes = [
  { path: '/', title: 'Home', render: LandingPage },
  { path: '/programs', title: 'Programs', render: ProgramList },
  { path: '/login', title: 'Sign In', auth: 'guest', render: LoginForm },
  { path: '/register', title: 'Register', auth: 'guest', render: RegisterForm },
  { path: '/forgot', title: 'Reset Password', auth: 'guest', render: ForgotPasswordForm },
  { path: '/dashboard', title: 'Dashboard', auth: 'applicant', render: Dashboard },
  {
    path: '/personal', title: 'Personal Data', auth: 'applicant', render: PersonalDataForm,
    guard: (s) => (status(s) === STATUS.SUBMITTED ? { to: '/dashboard', message: 'Your application is submitted — data can no longer be changed.' } : null),
  },
  {
    path: '/review', title: 'Application Review', auth: 'applicant', render: ApplicationReview,
    guard: (s) => {
      const st = status(s);
      if (st === STATUS.NOT_STARTED) return { to: '/personal', message: 'Complete your personal data first.' };
      if (st === STATUS.DATA_COMPLETED) return { to: '/programs', message: 'Select a study program before reviewing.' };
      if (st === STATUS.SUBMITTED) return { to: '/success' };
      return null;
    },
  },
  {
    path: '/success', title: 'Application Successful', auth: 'applicant', render: SuccessScreen,
    guard: (s) => (status(s) !== STATUS.SUBMITTED ? { to: '/dashboard', message: 'You have not submitted an application yet.' } : null),
  },
  { path: '/admin', title: 'Admin', auth: 'admin', render: AdminDashboard },
  {
    path: '*', title: 'Not Found',
    render: () => h('section', { class: 'container auth-wrap' },
      h('div', { class: 'holo-panel auth-card', style: { textAlign: 'center' } },
        h('div', { class: 'eyebrow' }, 'ERROR 404'),
        h('h2', {}, 'SIGNAL LOST'),
        h('p', { class: 'muted' }, 'The page you are looking for does not exist.'),
        h('a', { class: 'btn btn-primary', href: '#/' }, 'RETURN HOME'))),
  },
];
