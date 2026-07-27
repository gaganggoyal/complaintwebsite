// Email sending for OTP verification codes.
//
// Three delivery modes, picked in this order:
//   1. RESEND_API_KEY set  -> Resend HTTP API (no SMTP ports needed)
//   2. SMTP_USER/PASS set  -> any SMTP provider (Brevo, Zoho, Gmail app password…)
//   3. neither             -> DEV MODE: codes print to the terminal
//
// Mode 3 lets the whole flow be tested before email is configured.
const nodemailer = require('nodemailer');
const { otpEmail, welcomeEmail, activatedEmail } = require('./emails');

const resendKey = process.env.RESEND_API_KEY || '';
const hasResend = !!resendKey;
const hasSmtp = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
const hasEmail = hasResend || hasSmtp;

// Which mode we ended up in — logged at startup so misconfiguration is obvious.
const mode = hasResend ? 'resend' : (hasSmtp ? 'smtp' : 'dev');

let transporter = null;
if (!hasResend && hasSmtp) {
  // secure=true  -> implicit TLS (port 465)
  // secure=false -> STARTTLS (port 587, what Brevo recommends). requireTLS
  // makes the upgrade mandatory, so credentials can never cross in plaintext
  // if the server fails to advertise STARTTLS.
  const secure = String(process.env.SMTP_SECURE || 'true') !== 'false';
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure,
    requireTLS: !secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

// Resend's HTTP API. Node 18+ has global fetch, so this needs no new dependency.
async function sendViaResend({ from, to, subject, text, html, replyTo }) {
  const payload = { from, to: [to], subject, text, html };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    // Surface Resend's own message — it names the real problem (unverified
    // domain, bad key), which is otherwise very hard to guess from a 500.
    let detail = '';
    try {
      const body = await res.json();
      detail = body && (body.message || body.name) ? `${body.name || ''} ${body.message || ''}`.trim() : '';
    } catch (e) { /* non-JSON error body — status alone will have to do */ }
    throw new Error(`Resend API ${res.status}${detail ? ': ' + detail : ''}`);
  }
  return { devMode: false };
}

// Single delivery path for every template.
// `devLine` is what gets printed instead of sending when email is unconfigured.
async function send(to, tpl, devLine) {
  // MAIL_FROM must stay on a domain you have authenticated with the provider —
  // DMARC is evaluated against the From domain, so a free-mail address here
  // (gmail.com etc.) fails alignment and gets filtered as spoofing.
  // Use MAIL_REPLY_TO to route replies to an inbox you actually read.
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@complaint.website';
  const replyTo = process.env.MAIL_REPLY_TO || '';
  const { subject, text, html } = tpl;

  if (hasResend) return sendViaResend({ from, to, subject, text, html, replyTo });

  if (transporter) {
    const msg = { from, to, subject, text, html };
    if (replyTo) msg.replyTo = replyTo;
    await transporter.sendMail(msg);
    return { devMode: false };
  }

  console.log('\n================ DEV MODE — EMAIL NOT CONFIGURED ================');
  console.log(`  ${devLine}`);
  console.log('  (Set RESEND_API_KEY or SMTP_* in server/.env to send real emails.)');
  console.log('================================================================\n');
  return { devMode: true };
}

const WA_NUMBER = process.env.WA_NUMBER || '919569608101';

function waLinkFor(name, email, phone, planLabel, planPrice, kind) {
  const msg = kind === 'activated'
    ? `Namaste! I am ${name} (${email}). My ${planLabel} plan is active — I would like to start my complaint.`
    : `Namaste! I registered on complaint.website as ${name} (${email}), WhatsApp ${phone}. ` +
      `I chose the ${planLabel} (${planPrice}) plan and want to pay and activate it.`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function sendOtpEmail(to, name, otp, verifyLink) {
  return send(to, otpEmail({ name, otp, verifyLink }),
    `OTP for ${to}: ${otp}${verifyLink ? `\n  One-click link: ${verifyLink}` : ''}`);
}

// Sent once the email address is confirmed — carries the plan and the
// WhatsApp link used to pay.
function sendWelcomeEmail(user, planLabel, planPrice) {
  const waLink = waLinkFor(user.name, user.email, user.phone, planLabel, planPrice, 'welcome');
  return send(user.email, welcomeEmail({ name: user.name, planLabel, planPrice, waLink }),
    `Welcome email for ${user.email} (${planLabel})`);
}

// Sent when the plan is switched to active in the admin panel.
function sendActivatedEmail(user, planLabel, planPrice) {
  const waLink = waLinkFor(user.name, user.email, user.phone, planLabel, planPrice, 'activated');
  return send(user.email, activatedEmail({ name: user.name, planLabel, planPrice, waLink }),
    `Activation email for ${user.email} (${planLabel})`);
}

module.exports = {
  sendOtpEmail, sendWelcomeEmail, sendActivatedEmail,
  hasSmtp, hasEmail, mode
};
