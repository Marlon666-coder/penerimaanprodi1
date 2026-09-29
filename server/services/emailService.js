/**
 * Email notification service (server-side only — API keys never reach the browser).
 *
 * Providers (choose with EMAIL_PROVIDER in .env):
 *   none   -> no email is sent; the application stores email_status = NOT_CONFIGURED
 *   resend -> https://resend.com  (needs RESEND_API_KEY, uses built-in fetch)
 *   smtp   -> any SMTP server via Nodemailer (run `npm install nodemailer`,
 *             then set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS)
 *
 * Nothing is faked: the returned status is exactly what happened.
 */
import { config } from '../config.js';

export const EMAIL_STATUS = { SENT: 'SENT', FAILED: 'FAILED', NOT_CONFIGURED: 'NOT_CONFIGURED' };

export function isEmailConfigured() {
  const { provider, resendApiKey, smtp } = config.email;
  if (provider === 'resend') return !!resendApiKey;
  if (provider === 'smtp') return !!smtp.host;
  return false;
}

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function send({ to, subject, html, text }) {
  if (!isEmailConfigured()) return { status: EMAIL_STATUS.NOT_CONFIGURED };
  const { provider, from } = config.email;
  try {
    if (provider === 'resend') {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.email.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error(`Resend HTTP ${r.status}: ${await r.text()}`);
      return { status: EMAIL_STATUS.SENT };
    }
    if (provider === 'smtp') {
      let nodemailer;
      try {
        nodemailer = (await import('nodemailer')).default;
      } catch {
        throw new Error('Nodemailer is not installed. Run: npm install nodemailer');
      }
      const { host, port, secure, user, pass } = config.email.smtp;
      const transport = nodemailer.createTransport({ host, port, secure, auth: user ? { user, pass } : undefined });
      await transport.sendMail({ from, to, subject, html, text });
      return { status: EMAIL_STATUS.SENT };
    }
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return { status: EMAIL_STATUS.FAILED, error: err.message };
  }
  return { status: EMAIL_STATUS.NOT_CONFIGURED };
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

/** NEXUS ADMISSION — APPLICATION CONFIRMATION */
export function sendApplicationConfirmation(app) {
  const rows = [
    ['Nama', app.name],
    ['Program Studi', app.program_name],
    ['Nomor Pendaftaran', app.registration_number],
    ['Tanggal Pendaftaran', fmtDate(app.registration_date)],
    ['Status', app.status],
  ];
  const subject = 'NEXUS ADMISSION — APPLICATION CONFIRMATION';
  const text = `${subject}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nView your application: ${config.appUrl}/#/dashboard`;
  const html = `
  <div style="font-family:Arial,sans-serif;background:#050816;color:#F8FAFC;padding:32px">
    <h2 style="color:#00F5FF;letter-spacing:2px;margin:0 0 16px">NEXUS ADMISSION</h2>
    <p style="color:#8B5CF6;margin:0 0 24px;font-weight:bold">APPLICATION CONFIRMATION</p>
    <table style="border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#94a3b8">${escape(k)}</td><td style="padding:6px 0;font-weight:bold">${escape(v)}</td></tr>`).join('')}
    </table>
    <p style="margin-top:24px"><a style="color:#00F5FF" href="${escape(config.appUrl)}/#/dashboard">View your application</a></p>
  </div>`;
  return send({ to: app.email, subject, html, text });
}

export function sendPasswordResetCode(user, code) {
  const subject = 'NEXUS ADMISSION — Password Reset Code';
  const text = `Hello ${user.name},\n\nYour password reset code is: ${code}\nIt expires in 15 minutes.\nIf you did not request this, ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;background:#050816;color:#F8FAFC;padding:32px">
    <h2 style="color:#00F5FF">NEXUS ADMISSION</h2><p>Hello ${escape(user.name)},</p>
    <p>Your password reset code:</p><p style="font-size:28px;letter-spacing:4px;color:#00F5FF;font-weight:bold">${escape(code)}</p>
    <p style="color:#94a3b8">Expires in 15 minutes. If you did not request this, ignore this email.</p></div>`;
  return send({ to: user.email, subject, html, text });
}
