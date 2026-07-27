#!/usr/bin/env node
// Send a real verification-style email to prove the mail setup works.
//
//   node test-mail.js you@example.com
//
// Reports the provider's own error on failure — that message names the actual
// problem (unverified sender, wrong key, blocked port), which is otherwise
// very hard to guess from inside the app.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { sendOtpEmail, mode } = require('./mailer');

const to = process.argv[2];
if (!to) {
  console.error('Usage: node test-mail.js you@example.com');
  process.exit(1);
}

(async () => {
  console.log(`mode:  ${mode}`);
  console.log(`from:  ${process.env.MAIL_FROM || '(unset)'}`);
  console.log(`host:  ${process.env.SMTP_HOST || '(n/a)'}:${process.env.SMTP_PORT || ''}`);
  console.log(`to:    ${to}`);

  if (mode === 'dev') {
    console.log('\n⚠️  Still in dev mode — no credentials set, so nothing will be emailed.');
    process.exit(1);
  }

  console.log('\nsending…');
  try {
    await sendOtpEmail(to, 'Test', '123456');
    console.log('✅ Sent. Check the inbox (and the spam folder).');
    console.log('   If it landed in spam, the domain still needs SPF/DKIM in DNS.');
  } catch (e) {
    console.error('\n❌ Failed:', e && e.message ? e.message : e);
    console.error('\nCommon causes:');
    console.error('  · "sender not valid"  -> verify the from-address/domain in Brevo first');
    console.error('  · auth failure        -> using the API key (xkeysib-) instead of the SMTP key (xsmtpsib-)');
    console.error('  · timeout             -> outbound port 587 blocked by the host');
    process.exit(1);
  }
})();
