// Email sending for OTP verification codes.
// If SMTP is not configured in .env, codes are printed to the terminal (dev mode)
// so you can test the whole flow before setting up email.
const nodemailer = require('nodemailer');

const hasSmtp = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
if (hasSmtp) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
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

async function sendOtpEmail(to, name, otp) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@complaint.website';
  const subject = 'Your complaint.website verification code';
  const text =
    `Hi ${name || 'there'},\n\n` +
    `Your verification code is: ${otp}\n\n` +
    `It is valid for 10 minutes. If you did not request this, ignore this email.\n\n` +
    `— complaint.website (An IndiaOffers.in Company)`;

  if (!transporter) {
    console.log('\n================ DEV MODE — EMAIL NOT CONFIGURED ================');
    console.log(`  OTP for ${to}: ${otp}`);
    console.log('  (Set SMTP_* in server/.env to send real emails.)');
    console.log('================================================================\n');
    return { devMode: true };
  }

  await transporter.sendMail({ from, to, subject, text, html: otpEmailHtml(name, otp) });
  return { devMode: false };
}

module.exports = { sendOtpEmail, hasSmtp };
