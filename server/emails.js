// HTML email templates for complaint.website.
//
// Email clients are not browsers: Outlook's Word engine ignores border-radius
// and flexbox, and Gmail strips <style> blocks in several contexts. So these
// templates are table-based with fully inlined styles — verbose, but they
// render the same everywhere instead of collapsing into unstyled text.
//
// Copy is bilingual (English lead, Hindi beneath) to match the site.

const BRAND = {
  navy: '#163644',
  navyDark: '#0d2430',
  saffron: '#ff7a33',
  saffronDark: '#e85a18',
  green: '#12925a',
  greenBright: '#25D366',
  ink: '#1f2f38',
  muted: '#5d6f7a',
  bg: '#fbf5ec',
  card: '#ffffff',
  line: '#ede0d0',
  tint: '#fdf6ee'
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans','Noto Sans Devanagari',Arial,sans-serif";

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// The India tricolour strip used across the site, as a 3-cell table.
function tricolour() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
    <tr>
      <td width="33.3%" height="4" style="background-color:${BRAND.saffron};font-size:0;line-height:0">&nbsp;</td>
      <td width="33.4%" height="4" style="background-color:#ffffff;font-size:0;line-height:0">&nbsp;</td>
      <td width="33.3%" height="4" style="background-color:#138808;font-size:0;line-height:0">&nbsp;</td>
    </tr>
  </table>`;
}

// A button that survives Outlook: a table cell with padding, not a styled <a>.
function button(href, label, color) {
  const bg = color || BRAND.greenBright;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 auto">
    <tr>
      <td align="center" bgcolor="${bg}" style="border-radius:14px">
        <a href="${esc(href)}" target="_blank"
           style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function layout({ preheader, heading, headingHi, body }) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};-webkit-font-smoothing:antialiased">

<!-- Preview text shown in the inbox list, hidden in the message body -->
<div style="display:none;font-size:1px;color:${BRAND.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
  ${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.bg};border-collapse:collapse">
  <tr>
    <td align="center" style="padding:28px 14px 40px">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-collapse:collapse">

        <!-- brand header -->
        <tr>
          <td align="center" style="padding:0 0 20px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              <tr>
                <td align="center" style="font-family:${FONT};font-size:23px;font-weight:800;color:${BRAND.navy};letter-spacing:-.4px">
                  complaint<span style="color:${BRAND.saffronDark}">.website</span>
                </td>
              </tr>
              <tr>
                <td align="center" style="font-family:${FONT};font-size:10px;font-weight:700;color:${BRAND.muted};letter-spacing:1.2px;padding-top:5px">
                  AN INDIAOFFERS.IN COMPANY
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- card -->
        <tr>
          <td style="background-color:${BRAND.card};border:1px solid ${BRAND.line};border-radius:20px;overflow:hidden">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              <tr><td style="font-size:0;line-height:0">${tricolour()}</td></tr>
              <tr>
                <td style="padding:36px 34px 34px">

                  <h1 style="margin:0;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:800;color:${BRAND.navy};letter-spacing:-.3px">
                    ${heading}
                  </h1>
                  ${headingHi ? `<div style="margin:7px 0 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${BRAND.muted};font-weight:600">${headingHi}</div>` : ''}

                  ${body}

                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- safety note -->
        <tr>
          <td style="padding:22px 18px 0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              <tr>
                <td style="font-family:${FONT};font-size:12.5px;line-height:1.65;color:${BRAND.muted};text-align:center">
                  🔒 We never ask for your OTP, PIN, card number or bank password.<br />
                  <span style="color:#8d9aa3">हम कभी आपका OTP, PIN, कार्ड नंबर या बैंक पासवर्ड नहीं माँगते।</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td style="padding:18px 18px 0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid ${BRAND.line}">
              <tr>
                <td style="padding-top:16px;font-family:${FONT};font-size:11.5px;line-height:1.7;color:#9aa7b1;text-align:center">
                  <a href="https://complaint.website" style="color:${BRAND.muted};text-decoration:none;font-weight:600">complaint.website</a>
                  &nbsp;·&nbsp; An IndiaOffers.in Company<br />
                  You received this because someone used this address to register on complaint.website.
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------- OTP code
function otpEmail({ name, otp }) {
  const body = `
    <p style="margin:22px 0 0;font-family:${FONT};font-size:15.5px;line-height:1.65;color:${BRAND.ink}">
      Hi ${esc(name) || 'there'}, use this code to verify your email address:
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:22px 0 0">
      <tr>
        <td align="center" style="background-color:${BRAND.tint};border:1px solid ${BRAND.line};border-radius:16px;padding:26px 16px">
          <div style="font-family:${FONT};font-size:11px;font-weight:700;color:${BRAND.muted};letter-spacing:1.4px;text-transform:uppercase">
            Verification code
          </div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:40px;font-weight:800;color:${BRAND.navy};letter-spacing:11px;line-height:1.25;padding:10px 0 0;text-indent:11px">
            ${esc(otp)}
          </div>
          <div style="font-family:${FONT};font-size:13px;color:${BRAND.saffronDark};font-weight:600;padding-top:8px">
            Expires in 10 minutes
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:22px 0 0;font-family:${FONT};font-size:14.5px;line-height:1.65;color:${BRAND.muted}">
      अपना ईमेल verify करने के लिए यह code डालिए। यह 10 मिनट के लिए मान्य है।
    </p>

    <p style="margin:20px 0 0;font-family:${FONT};font-size:13.5px;line-height:1.65;color:${BRAND.muted}">
      Didn't try to register? You can safely ignore this email — nothing will happen.
    </p>`;

  return {
    subject: `${otp} is your complaint.website verification code`,
    preheader: `Your code is ${otp}. It expires in 10 minutes.`,
    html: layout({
      preheader: `Your code is ${otp}. It expires in 10 minutes.`,
      heading: 'Verify your email',
      headingHi: 'अपना ईमेल verify कीजिए',
      body
    }),
    text:
      `Hi ${name || 'there'},\n\n` +
      `Your complaint.website verification code is: ${otp}\n\n` +
      `It is valid for 10 minutes.\n\n` +
      `If you did not request this, ignore this email.\n\n` +
      `We never ask for your OTP, PIN, card number or bank password.\n\n` +
      `— complaint.website (An IndiaOffers.in Company)`
  };
}

// -------------------------------------------------- verified / next steps
function welcomeEmail({ name, planLabel, planPrice, waLink }) {
  const body = `
    <p style="margin:22px 0 0;font-family:${FONT};font-size:15.5px;line-height:1.65;color:${BRAND.ink}">
      Welcome, ${esc(name) || 'there'} — your email is verified. One step is left before we can start
      work on your complaint.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:22px 0 0">
      <tr>
        <td style="background-color:${BRAND.tint};border:1px solid ${BRAND.line};border-radius:16px;padding:20px 22px">
          <div style="font-family:${FONT};font-size:11px;font-weight:700;color:${BRAND.muted};letter-spacing:1.2px;text-transform:uppercase">
            Your selected plan
          </div>
          <div style="font-family:${FONT};font-size:19px;font-weight:800;color:${BRAND.navy};padding-top:6px">
            ${esc(planLabel)} <span style="color:${BRAND.saffronDark}">· ${esc(planPrice)}</span>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${BRAND.ink};font-weight:700">
      How to activate
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:10px 0 0">
      <tr>
        <td style="font-family:${FONT};font-size:14.5px;line-height:1.75;color:${BRAND.ink};padding:0 0 0 2px">
          <b style="color:${BRAND.saffronDark}">1.</b> &nbsp;Tap the button below — it opens WhatsApp with your details filled in.<br />
          <b style="color:${BRAND.saffronDark}">2.</b> &nbsp;We reply with the exact amount and our official UPI QR.<br />
          <b style="color:${BRAND.saffronDark}">3.</b> &nbsp;Pay, send the screenshot, and we activate your plan in writing.
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:26px 0 0">
      <tr><td align="center">${button(waLink, '💬&nbsp; Pay &amp; activate on WhatsApp')}</td></tr>
    </table>

    <p style="margin:22px 0 0;font-family:${FONT};font-size:14px;line-height:1.65;color:${BRAND.muted};text-align:center">
      आपका ईमेल verify हो गया है। WhatsApp पर payment करके अपना plan activate कीजिए।
    </p>

    <p style="margin:20px 0 0;font-family:${FONT};font-size:13px;line-height:1.65;color:${BRAND.muted};text-align:center">
      No payment is ever collected on this website.
    </p>`;

  return {
    subject: 'Your email is verified — one step left',
    preheader: `${planLabel} selected. Activate it on WhatsApp to get started.`,
    html: layout({
      preheader: `${planLabel} selected. Activate it on WhatsApp to get started.`,
      heading: 'Email verified 🎉',
      headingHi: 'ईमेल verify हो गया',
      body
    }),
    text:
      `Welcome, ${name || 'there'}!\n\n` +
      `Your email is verified. Selected plan: ${planLabel} (${planPrice}).\n\n` +
      `One step left — activate on WhatsApp:\n${waLink}\n\n` +
      `1. Message us on WhatsApp (link above, details pre-filled).\n` +
      `2. We reply with the exact amount and our official UPI QR.\n` +
      `3. Pay, send the screenshot, and we activate your plan.\n\n` +
      `No payment is ever collected on this website.\n\n` +
      `— complaint.website (An IndiaOffers.in Company)`
  };
}

// ------------------------------------------------------- plan activated
function activatedEmail({ name, planLabel, planPrice, waLink }) {
  const body = `
    <p style="margin:22px 0 0;font-family:${FONT};font-size:15.5px;line-height:1.65;color:${BRAND.ink}">
      Thank you, ${esc(name) || 'there'} — your payment is confirmed and your plan is now
      <b style="color:${BRAND.green}">active</b>. We're ready to take up your complaint.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:22px 0 0">
      <tr>
        <td style="background-color:#f0faf4;border:1px solid #bfe7cf;border-radius:16px;padding:20px 22px">
          <div style="font-family:${FONT};font-size:11px;font-weight:700;color:${BRAND.green};letter-spacing:1.2px;text-transform:uppercase">
            ✓ Active plan
          </div>
          <div style="font-family:${FONT};font-size:19px;font-weight:800;color:${BRAND.navy};padding-top:6px">
            ${esc(planLabel)} <span style="color:${BRAND.green}">· ${esc(planPrice)}</span>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${BRAND.ink};font-weight:700">
      What happens next
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:10px 0 0">
      <tr>
        <td style="font-family:${FONT};font-size:14.5px;line-height:1.75;color:${BRAND.ink};padding:0 0 0 2px">
          <b style="color:${BRAND.green}">1.</b> &nbsp;Send us the details of your complaint on WhatsApp.<br />
          <b style="color:${BRAND.green}">2.</b> &nbsp;We draft it professionally and file it with the right authority.<br />
          <b style="color:${BRAND.green}">3.</b> &nbsp;We follow up until you get a resolution.
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:26px 0 0">
      <tr><td align="center">${button(waLink, '💬&nbsp; Start my complaint')}</td></tr>
    </table>

    <p style="margin:22px 0 0;font-family:${FONT};font-size:14px;line-height:1.65;color:${BRAND.muted};text-align:center">
      आपका plan active हो गया है। WhatsApp पर अपनी शिकायत की जानकारी भेजिए।
    </p>`;

  return {
    subject: 'Your plan is active — let\'s get started',
    preheader: `${planLabel} is now active. Send us your complaint details on WhatsApp.`,
    html: layout({
      preheader: `${planLabel} is now active. Send us your complaint details on WhatsApp.`,
      heading: 'Your plan is active ✅',
      headingHi: 'आपका plan active हो गया',
      body
    }),
    text:
      `Thank you, ${name || 'there'}!\n\n` +
      `Your payment is confirmed and your ${planLabel} (${planPrice}) plan is now ACTIVE.\n\n` +
      `What happens next:\n` +
      `1. Send us your complaint details on WhatsApp: ${waLink}\n` +
      `2. We draft it professionally and file it with the right authority.\n` +
      `3. We follow up until you get a resolution.\n\n` +
      `— complaint.website (An IndiaOffers.in Company)`
  };
}

module.exports = { otpEmail, welcomeEmail, activatedEmail };
