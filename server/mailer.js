// Email sending for OTP verification codes.
//
// Three delivery modes, picked in this order:
//   1. RESEND_API_KEY set  -> Resend HTTP API (no SMTP ports needed)
//   2. SMTP_USER/PASS set  -> any SMTP provider (Brevo, Zoho, Gmail app password…)
//   3. neither             -> DEV MODE: codes print to the terminal
//
// Mode 3 lets the whole flow be tested before email is configured.
const nodemailer = require('nodemailer');

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

function otpEmailHtml(name, otp) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#26343d">
    <div style="text-align:center;margin-bottom:18px">
      <span style="display:inline-block;background:linear-gradient(135deg,#ff7f3f,#ec5f22);color:#fff;font-weight:800;font-size:18px;padding:10px 16px;border-radius:12px">complaint.website</span>
      <div style="font-size:11px;color:#627480;margin-top:6px;letter-spacing:.5px">AN INDIAOFFERS.IN COMPANY</div>
    </div>
    <p style="font-size:15px">Hi ${name || 'there'},</p>
    <p style="font-size:15px">Your verification code is:</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:8px;text-align:center;color:#1c3d4d;background:#fdf6ee;border:1px solid #efe3d5;border-radius:14px;padding:18px 0;margin:14px 0">${otp}</div>
    <p style="font-size:14px;color:#627480">This code is valid for 10 minutes. If you did not request it, you can safely ignore this email.</p>
    <p style="font-size:13px;color:#9aa7b1;margin-top:22px">— complaint.website · An IndiaOffers.in Company</p>
  </div>`;
}

// Resend's HTTP API. Node 18+ has global fetch, so this needs no new dependency.
async function sendViaResend({ from, to, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject, text, html })
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

async function sendOtpEmail(to, name, otp) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@complaint.website';
  const subject = 'Your complaint.website verification code';
  const text =
    `Hi ${name || 'there'},\n\n` +
    `Your verification code is: ${otp}\n\n` +
    `It is valid for 10 minutes. If you did not request this, ignore this email.\n\n` +
    `— complaint.website (An IndiaOffers.in Company)`;
  const html = otpEmailHtml(name, otp);

  if (hasResend) return sendViaResend({ from, to, subject, text, html });

  if (transporter) {
    await transporter.sendMail({ from, to, subject, text, html });
    return { devMode: false };
  }

  console.log('\n================ DEV MODE — EMAIL NOT CONFIGURED ================');
  console.log(`  OTP for ${to}: ${otp}`);
  console.log('  (Set RESEND_API_KEY or SMTP_* in server/.env to send real emails.)');
  console.log('================================================================\n');
  return { devMode: true };
}

module.exports = { sendOtpEmail, hasSmtp, hasEmail, mode };
