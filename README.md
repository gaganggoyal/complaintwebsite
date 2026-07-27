# complaint.website — An IndiaOffers.in Company

A bilingual (English + हिंदी) consumer-complaint resolution service, now with a
**user registration + email-OTP login system** and plan selection.

There are two parts:

1. **Marketing site** — `index.html` (single file, works as plain static HTML).
2. **Accounts app** — a small Node.js server (`server/`) that powers Register,
   Email-OTP verification, Login, and the customer Dashboard. The auth pages
   (`register.html`, `verify.html`, `login.html`, `dashboard.html`) need this
   server running; they call its `/api/...` endpoints.

Payment is **not** collected on the website. A customer registers, picks a plan,
verifies their email, then contacts you on WhatsApp — the dashboard opens a
pre-filled message with their name, email, phone and chosen plan. You send the
UPI QR / payment details privately and activate their plan.

---

## Quick preview (marketing site only)

Just open `index.html` in a browser (double-click), or:

```
cd complaint-sahayak && python3 -m http.server 8080
```

The Register/Login buttons won't work this way — they need the server (below).

## Run the full app (accounts + site)

You need **Node.js 18+** installed.

```
cd complaint-sahayak/server
npm install
cp .env.example .env        # then edit .env (see below)
npm start
```

Open **http://localhost:3000** — this serves the marketing site AND the auth pages.

### Configure `.env`

- **SESSION_SECRET** — set a long random string. Generate one with:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Email (SMTP)** — to actually send OTP codes. Easiest is **Gmail with an
  App Password**:
  1. Turn on 2-Step Verification for your Google account (indiaoffers.in@gmail.com).
  2. Google Account → Security → **App passwords** → generate one for "Mail".
  3. Put that 16-character password in `SMTP_PASS`, and your Gmail in `SMTP_USER`.
- **Dev mode:** if you leave `SMTP_USER`/`SMTP_PASS` blank, the server prints each
  OTP **in the terminal** instead of emailing it — handy for testing before you set
  up email.

---

## How the customer flow works

1. **Register** (`register.html`) — name, email, WhatsApp number, password, and a
   plan (Single ₹9 / Monthly ₹499 / Annual ₹999). Pricing buttons on the site link
   here with the plan pre-selected (e.g. `register.html?plan=annual`).
2. **Verify** (`verify.html`) — we email a 6-digit code; they enter it. The code
   expires in 10 minutes; they can resend after a short cooldown.
3. **Dashboard** (`dashboard.html`) — shows their plan and a **"Pending activation"**
   badge, plus a big **Pay & activate on WhatsApp** button (pre-filled with their
   details). Login is at `login.html`.
4. **You activate** — after they pay on WhatsApp, mark them active (see below).

### Marking a customer "active" after payment

Open **https://complaint.website/admin.html** and sign in with `ADMIN_PASSWORD`.
The panel lists every signup with their plan, contact details and status. After
a customer pays, click **✓ Mark active** — their dashboard badge switches to
**Active** immediately.

The panel also lets you message a customer on WhatsApp (pre-filled with their
plan), leave a private note against their account (e.g. "paid via UPI 27 Jul"),
and delete test or spam signups.

If `ADMIN_PASSWORD` is blank the admin panel is switched off entirely, so it is
never exposed behind an empty password.

---

## Deploying

The accounts system means this needs a **Node host**, not static hosting. Any
VPS or Node platform works.

- Run `npm ci --omit=dev` then `node server.js` in `server/`. If you deploy by
  copying files, install dependencies **on the server** — `better-sqlite3` is a
  native module and must be built for the target platform.
- Set `NODE_ENV=production` and a real `SESSION_SECRET`.
- Serve it over HTTPS; production sets the session cookie to HTTPS-only.
- Put it behind a reverse proxy and don't expose the app port publicly.
- Exclude `server/data` and `server/.env` from any file sync, so deploys never
  overwrite the live database or secrets.

Server addresses, paths and credentials are kept in private operational notes,
not in this repository.

### Back up your data
`server/data/app.db` holds every registration. Back it up regularly.

---

## Language toggle

- The **EN / हिंदी** toggle is on every page (marketing + auth). The choice is
  saved in the visitor's browser (`localStorage`) and applied across all pages.
- Default is English. To make Hindi the default, in each HTML file change the small
  script right after `<body>`: `localStorage.getItem('cw-lang')==='hi'` →
  `localStorage.getItem('cw-lang')!=='en'`.
- Any text you change must be changed in **both** languages (English text has class
  `l-en`, the Hindi version sits next to it with class `l-hi`).

## Before going live — check these

1. **Service hours** — shown in the top bar ("Mon–Sat · 10am–8pm") and the footer;
   edit both if yours differ.
2. **Refund policy / Terms** — read the FAQ answer on refunds and the Terms/Privacy
   summaries. These are sensible defaults, but they are YOUR promises — edit them in
   both languages.
3. **SMTP / email** — configure it (above) so OTP codes actually reach customers.
4. **HTTPS + SESSION_SECRET + NODE_ENV=production** on the live host.

## Marketing integrity notes

- Claim only what is true today: 15+ years experience, the process, the pricing.
- The hero chat window is labelled "Sample conversation" — keep that label.
- Do NOT add invented numbers ("10,000 complaints resolved") or fake testimonials —
  one exposed fake kills a trust business. Add real, consented testimonials later.
- Keep a simple record of every case (date, company, issue, fee, outcome, days).
  Real stats become your best marketing within months.
