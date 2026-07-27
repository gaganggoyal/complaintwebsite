# complaint.website

> **आपकी शिकायत, हमारी ज़िम्मेदारी** — a bilingual (English + हिंदी) consumer
> complaint resolution service for Indian consumers.
> An IndiaOffers.in Company.

A customer registers, confirms their email, picks a plan, and pays over WhatsApp.
No payment details are ever collected on the website.

---

## What's in here

| Part | Description |
|---|---|
| Marketing site | `index.html` — single-file, bilingual, works as plain static HTML |
| Accounts app | `server/` — Node/Express: registration, email confirmation, login |
| Customer pages | `register.html`, `verify.html`, `login.html`, `dashboard.html` |
| Admin panel | `admin.html` — review signups, activate customers after payment |
| Installable app | `manifest.webmanifest`, `sw.js`, `offline.html`, `assets/pwa.js` |
| Complaint guides | `guides/` — free how-to pages, the site's organic search surface |
| Brand assets | `assets/brand/` — icons, social card, and the script that builds them |

The auth pages call the server's `/api/...` endpoints, so they need it running.

## Features

- **Bilingual throughout** — English and हिंदी across the site, the account
  pages and every email, switchable at any time.
- **Email confirmation, two ways** — a one-click confirm button, plus a 6-digit
  code for clients that strip links or a customer reading mail on another device.
- **Admin panel** — see every signup with their plan and status, mark a customer
  active once payment arrives, resend a confirmation email to anyone stuck
  unverified, leave private notes, and message them on WhatsApp with their
  details pre-filled.
- **Transactional email** — verification, "email confirmed", and "plan activated"
  messages, table-based and inline-styled so they render intact in Outlook and
  Gmail, each with a plain-text alternative.
- **Installable** — meets the browser install criteria, so Android and desktop
  offer "Install app" and iOS Safari can add it to the home screen. Runs
  full-screen with its own icon and splash screen.
- **Works offline** — a service worker serves pages network-first and keeps the
  last good copy, so a dropped connection shows the site rather than a browser
  error page. API calls are never cached.
- **No payment handling** — activation happens over WhatsApp, so the site never
  touches card or UPI data.

## Installable app (PWA)

| File | Role |
|---|---|
| `manifest.webmanifest` | Name, icons, colours, shortcuts — what the installed app looks like |
| `sw.js` | Caching strategy and the offline fallback |
| `offline.html` | Shown only if a page is requested that was never cached |
| `assets/pwa.js` | Registers the worker and drives the install prompt |

Any element with `class="js-install" hidden` becomes an install button — the
script reveals it only when the browser can genuinely install, and falls back to
Add-to-Home-Screen instructions on iOS Safari, which has no install API.

**Caching rules**, in `sw.js`: `/api/*` is never cached; page navigations are
network-first so a deploy is live immediately; static assets are
stale-while-revalidate. Bump `CACHE_VERSION` when the precache list changes.

Serve `sw.js` and `manifest.webmanifest` with `Cache-Control: no-cache`. A
hard-cached worker is the one file a later deploy cannot fix.

## Complaint guides

`guides/` holds free, bilingual how-to pages — one per question people actually
type into a search engine ("refund not received", "money debited but payment
failed", "how to complain to the banking ombudsman", "insurance claim
rejected"). A one-page site can rank for one thing; these are what give it a
surface. Each converts to registration at the foot of the article.

They share `assets/guide.css` and `assets/guide.js` and are otherwise plain
standalone files — no build step, so a deploy stays an `rsync`.

**Adding a guide.** Copy the closest existing one and change the content, then:

1. Update `<title>`, description, `<link rel="canonical">` and the Open Graph
   and Twitter tags to the new URL.
2. Update all three JSON-LD blocks — breadcrumb, `Article`, and the `FAQPage`,
   which must match the questions actually on the page.
3. Add it to `sitemap.xml`, to `guides/index.html`, and to the `#guides` grid
   on the homepage.
4. Cross-link it from the related-guides block of its neighbours.

**Writing rules that matter here.** Never state a company's grievance email
address or a regulator's monetary limit as settled fact — those change, and a
wrong one in print is worse than no page at all. Describe *where* to find the
current value instead. Keep the legal-information disclaimer in the footer.

`assets/guide.js` is deliberately separate from `assets/auth.js`: the latter
drives the dashboard and redirects to the login page on a 401, which would be a
disaster on a page someone reached from a search result.

## Search engines

`sitemap.xml` and `robots.txt` sit at the project root; the sitemap URL is
declared in `robots.txt`. Every page carries Open Graph and Twitter card tags,
a canonical URL, and JSON-LD — the homepage covers the organisation, the service
and its plans, and the FAQ; the guides add breadcrumbs and `Article`. Keep FAQ
JSON-LD in step with the visible FAQ; Google treats a mismatch as
structured-data spam.

Bilingual headings use one element with `.l-en` / `.l-hi` spans inside, never
two sibling headings. Two headings sharing an `id` is invalid — anchors and the
scrollspy both break — and two `<h1>`s split the page's own title signal.

Regenerate icons and the social card after a brand change:

```bash
bash assets/brand/build-icons.sh    # needs librsvg + imagemagick
```

## Requirements

Node.js 18 or newer. No external database — the app uses a local SQLite file.

## Running locally

```bash
cd server
npm install
cp .env.example .env      # then edit it, see below
npm start
```

Open <http://localhost:3000>, which serves the marketing site and the account
pages together.

### Configuration

Everything is set through `server/.env`. Copy `.env.example` and fill it in:

| Variable | Purpose |
|---|---|
| `PORT` | Port to listen on (default `3000`) |
| `NODE_ENV` | `production` enables HTTPS-only cookies |
| `SESSION_SECRET` | Signs login sessions — **required** in production |
| `ADMIN_PASSWORD` | Password for the admin panel; blank disables it entirely |
| `RESEND_API_KEY` | Option A for email: Resend's HTTP API |
| `SMTP_*` | Option B: any SMTP provider (Brevo, Zoho, Gmail app password) |
| `MAIL_FROM` | Sender address — must be on a domain you've authenticated |
| `MAIL_REPLY_TO` | Where customer replies go |
| `APP_URL` | Public base URL, used to build confirmation links |

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Dev mode:** leave both `RESEND_API_KEY` and `SMTP_USER`/`SMTP_PASS` blank and
confirmation codes print to the terminal instead of being emailed — enough to
exercise the whole signup flow before email is set up.

### Setting up email

`server/setup-mail.sh` walks through SMTP credentials interactively (the key is
read hidden, so it stays out of your shell history), then restarts the service.
Send yourself a test with:

```bash
node server/test-mail.js you@example.com all
```

For mail to reach inboxes rather than spam, the sending domain needs **SPF and
DKIM** records, and `MAIL_FROM` must use that domain. A free-mail From address
(gmail.com and friends) fails DMARC alignment no matter how the domain is
configured, because DMARC is evaluated against the From domain.

## How the customer flow works

1. **Register** — name, email, WhatsApp number, password, and a plan. Pricing
   buttons deep-link with the plan preselected (`register.html?plan=annual`).
2. **Confirm** — one click from the email, or the 6-digit code. Codes and links
   expire after 10 minutes.
3. **Dashboard** — shows their plan and a *Pending activation* badge, with a
   WhatsApp button pre-filled with their details.
4. **Activate** — once they pay, mark them active in the admin panel. Their
   badge flips to *Active* and they get a confirmation email.

## Admin panel

At `/admin.html`, protected by `ADMIN_PASSWORD`. If that variable is blank the
whole admin surface returns 503, so a missing config can't leave customer data
behind an empty password.

## Deploying

The accounts system means this needs a **Node host**, not static hosting. Any
VPS or Node platform works.

- Run `npm ci --omit=dev` then `node server.js` in `server/`. If you deploy by
  copying files, install dependencies **on the server** — `better-sqlite3` is a
  native module and must be built for the target platform.
- Set `NODE_ENV=production` and a real `SESSION_SECRET`; the app refuses to
  start in production without one.
- Serve it over HTTPS. Production sets the session cookie to HTTPS-only, and
  it's a login system regardless.
- Put it behind a reverse proxy and don't expose the app port publicly.
- Exclude `server/data` and `server/.env` from any file sync, so deploys never
  overwrite the live database or secrets.
- Version the `?v=` string on asset URLs when CSS/JS changes, so returning
  browsers don't run a cached copy.

`server/` is never served over the web — source, `.env` and the database are all
blocked — and `data/`, `node_modules/` and `.env` are git-ignored.

## Security notes

- Passwords are bcrypt-hashed; confirmation codes are hashed too, never stored
  in the clear.
- One-click links are 256-bit tokens stored only as a SHA-256 hash, single-use,
  expiring with the code and rotating on every resend.
- Confirmation is a `POST` driven by the page rather than a `GET` on the link
  itself, so mail scanners and link-preview bots — which follow URLs but don't
  run JavaScript — can't burn the token or capture the session.
- Signing in regenerates the session id, preventing session fixation.
- Registration, confirmation and admin login are rate-limited.

## Licence

Copyright © IndiaOffers.in. All rights reserved. See [LICENSE](LICENSE).
