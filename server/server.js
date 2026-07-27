// complaint.website — registration + email-OTP authentication server
// An IndiaOffers.in Company
require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const SqliteStore = require('better-sqlite3-session-store')(session);

const db = require('./db');
const {
  sendOtpEmail, sendWelcomeEmail, sendActivatedEmail,
  hasEmail, mode: mailMode
} = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Plans offered at registration
const PLANS = {
  single:  { label: 'Single Complaint',   price: '₹9' },
  monthly: { label: 'Monthly Membership', price: '₹499' },
  annual:  { label: 'Annual Membership',  price: '₹999' }
};

const OTP_TTL = 10 * 60 * 1000;       // code valid for 10 minutes
const RESEND_COOLDOWN = 45 * 1000;    // min gap between code sends
const MAX_OTP_ATTEMPTS = 5;

// ---------- helpers ----------
const genOtp = () => String(crypto.randomInt(100000, 1000000)); // 6 digits
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validPhone = (p) => /^[0-9+\-\s]{7,15}$/.test(p);
const cleanEmail = (e) => (e || '').trim().toLowerCase();

// Sign a user in on a fresh session id, so a session fixed before login
// cannot be reused afterwards.
function signIn(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      resolve();
    });
  });
}

// ---------- middleware ----------
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// A missing secret in production would silently log everyone out on each
// restart, so refuse to start rather than run in that state.
if (!process.env.SESSION_SECRET) {
  if (isProd) {
    console.error('✖  SESSION_SECRET must be set in production. Refusing to start.');
    process.exit(1);
  }
  console.warn('⚠️  SESSION_SECRET is not set in .env — using a temporary secret (sessions reset on restart).');
}

app.use(session({
  name: 'cw.sid',
  // Sessions live in the SQLite file, so restarts and deploys don't sign
  // everyone out (the default MemoryStore also leaks under real traffic).
  store: new SqliteStore({
    client: db.raw,
    expired: { clear: true, intervalMs: 15 * 60 * 1000 }
  }),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(24).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

// Never serve the server directory (source, .env, database) as static content
app.use((req, res, next) => {
  if (req.path === '/server' || req.path.startsWith('/server/')) return res.status(404).end();
  next();
});

// Serve the marketing site + auth pages (project root, one level up)
app.use(express.static(path.join(__dirname, '..'), {
  extensions: ['html'],
  dotfiles: 'ignore'
}));

// ---------- rate limiters ----------
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });
const otpLimiter  = rateLimit({ windowMs: 10 * 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false });

// ---------- API ----------

// Register: validate, create/refresh an unverified account, email an OTP.
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    let { name, email, phone, password, plan } = req.body || {};
    name = (name || '').trim();
    email = cleanEmail(email);
    phone = (phone || '').trim();

    if (name.length < 2)       return res.status(400).json({ error: 'Please enter your name.' });
    if (!validEmail(email))     return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!validPhone(phone))     return res.status(400).json({ error: 'Please enter a valid WhatsApp number.' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (!PLANS[plan])           return res.status(400).json({ error: 'Please choose a plan.' });

    const existing = db.getUserByEmail(email);
    if (existing && existing.email_verified) {
      return res.status(409).json({ error: 'This email is already registered. Please sign in instead.' });
    }

    const otp = genOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const pwHash = await bcrypt.hash(password, 10);
    const now = Date.now();

    const record = {
      name, email, phone, password_hash: pwHash, plan,
      otp_hash: otpHash, otp_expires: now + OTP_TTL, otp_last_sent: now
    };
    if (existing) db.updateUnverified(record);
    else db.createUser({ ...record, created_at: now });

    // The account row already exists at this point; if delivery fails the user
    // can still recover via "resend" on the verify page, so say so plainly
    // instead of returning an opaque 500.
    let result;
    try {
      result = await sendOtpEmail(email, name, otp);
    } catch (mailErr) {
      console.error('register: email delivery failed:', mailErr);
      return res.status(502).json({ error: 'We could not send the verification email just now. Please try again in a moment.' });
    }

    req.session.pendingEmail = email;
    return res.json({ ok: true, email, devMode: !!result.devMode });
  } catch (e) {
    console.error('register error:', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Verify the emailed OTP. On success, the user is signed in.
app.post('/api/verify', otpLimiter, async (req, res) => {
  try {
    const email = cleanEmail(req.body && req.body.email);
    const otp = ((req.body && req.body.otp) || '').trim();

    const user = db.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'No pending registration for this email.' });
    if (user.email_verified) { await signIn(req, user.id); return res.json({ ok: true }); }

    if (!user.otp_hash || !user.otp_expires || Date.now() > user.otp_expires) {
      return res.status(400).json({ error: 'Your code has expired. Please resend a new code.' });
    }
    if (user.otp_attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many attempts. Please resend a new code.' });
    }

    const good = await bcrypt.compare(otp, user.otp_hash);
    if (!good) {
      db.incOtpAttempts(email);
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }

    db.markVerified(email, Date.now());
    await signIn(req, user.id);

    // Welcome mail is a nice-to-have: never let a mail failure block the
    // verification the customer just completed.
    const plan = PLANS[user.plan] || { label: user.plan, price: '' };
    sendWelcomeEmail(user, plan.label, plan.price)
      .catch((e) => console.error('welcome email failed:', e && e.message));

    return res.json({ ok: true });
  } catch (e) {
    console.error('verify error:', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Resend a fresh OTP (with a short cooldown).
app.post('/api/resend', otpLimiter, async (req, res) => {
  try {
    const email = cleanEmail(req.body && req.body.email);
    const user = db.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'No pending registration for this email.' });
    if (user.email_verified) return res.status(400).json({ error: 'Already verified. Please sign in.' });
    if (user.otp_last_sent && Date.now() - user.otp_last_sent < RESEND_COOLDOWN) {
      return res.status(429).json({ error: 'Please wait a few seconds before requesting another code.' });
    }

    const otp = genOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const now = Date.now();
    db.setOtp(email, otpHash, now + OTP_TTL, now);

    let result;
    try {
      result = await sendOtpEmail(email, user.name, otp);
    } catch (mailErr) {
      console.error('resend: email delivery failed:', mailErr);
      return res.status(502).json({ error: 'We could not send the email just now. Please try again in a moment.' });
    }
    return res.json({ ok: true, devMode: !!result.devMode });
  } catch (e) {
    console.error('resend error:', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Login with email + password.
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const email = cleanEmail(req.body && req.body.email);
    const password = (req.body && req.body.password) || '';

    const user = db.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

    if (!user.email_verified) {
      const otp = genOtp();
      const otpHash = await bcrypt.hash(otp, 10);
      const now = Date.now();
      db.setOtp(email, otpHash, now + OTP_TTL, now);
      let result = {};
      try {
        result = await sendOtpEmail(email, user.name, otp);
      } catch (mailErr) {
        // Still send them to the verify page — "resend" there is the retry.
        console.error('login: email delivery failed:', mailErr);
      }
      req.session.pendingEmail = email;
      return res.status(403).json({ error: 'Please verify your email first — we just sent you a code.', needVerify: true, email, devMode: !!result.devMode });
    }

    await signIn(req, user.id);
    return res.json({ ok: true });
  } catch (e) {
    console.error('login error:', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Current signed-in user (used by the dashboard).
app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not signed in.' });
  const user = db.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  const plan = PLANS[user.plan] || { label: user.plan, price: '' };
  return res.json({
    name: user.name,
    email: user.email,
    phone: user.phone,
    plan: user.plan,
    planLabel: plan.label,
    planPrice: plan.price,
    plan_status: user.plan_status,
    email_verified: !!user.email_verified
  });
});

// ---------- admin ----------
// Guarded by a single ADMIN_PASSWORD in .env. If it is unset the whole admin
// surface stays switched off, so a forgotten config can never expose customer
// data behind a blank password.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const adminEnabled = ADMIN_PASSWORD.length > 0;
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

// Constant-time compare over digests, so lengths match and the comparison
// leaks no timing information about the password.
function passwordMatches(given) {
  const a = crypto.createHash('sha256').update(String(given)).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (!adminEnabled) return res.status(503).json({ error: 'Admin is not configured on this server.' });
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Not signed in as admin.' });
  next();
}

app.post('/api/admin/login', adminLimiter, (req, res) => {
  if (!adminEnabled) return res.status(503).json({ error: 'Admin is not configured on this server.' });
  const password = (req.body && req.body.password) || '';
  if (!password || !passwordMatches(password)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  // Prevent session fixation: a login must not keep the pre-login session id.
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start session.' });
    req.session.isAdmin = true;
    res.json({ ok: true });
  });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/session', (req, res) => {
  res.json({ enabled: adminEnabled, signedIn: !!req.session.isAdmin });
});

// Customer list + headline counts for the dashboard.
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = 50;
  const users = db.listUsers(perPage, (page - 1) * perPage);
  res.json({
    users,
    stats: db.stats(),
    page,
    perPage,
    total: db.countUsers()
  });
});

// Flip a customer between pending and active after payment lands on WhatsApp.
app.post('/api/admin/status', requireAdmin, (req, res) => {
  const id = parseInt(req.body && req.body.id, 10);
  const status = (req.body && req.body.status) || '';
  if (!id) return res.status(400).json({ error: 'Missing user id.' });
  if (status !== 'active' && status !== 'pending') {
    return res.status(400).json({ error: 'Status must be "active" or "pending".' });
  }
  const user = db.getUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  db.setStatus(id, status, status === 'active' ? Date.now() : null);
  console.log(`admin: ${user.email} -> ${status}`);

  // Only on the pending -> active transition, so re-clicking Active does not
  // email the customer twice. Never blocks the admin action.
  if (status === 'active' && user.plan_status !== 'active') {
    const plan = PLANS[user.plan] || { label: user.plan, price: '' };
    sendActivatedEmail(user, plan.label, plan.price)
      .catch((e) => console.error('activation email failed:', e && e.message));
  }

  res.json({ ok: true });
});

app.post('/api/admin/note', requireAdmin, (req, res) => {
  const id = parseInt(req.body && req.body.id, 10);
  const note = String((req.body && req.body.note) || '').slice(0, 500);
  if (!id) return res.status(400).json({ error: 'Missing user id.' });
  db.setNote(id, note);
  res.json({ ok: true });
});

// For clearing out test signups and spam.
app.post('/api/admin/delete', requireAdmin, (req, res) => {
  const id = parseInt(req.body && req.body.id, 10);
  if (!id) return res.status(400).json({ error: 'Missing user id.' });
  const user = db.getUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  db.deleteUser(id);
  console.log(`admin: deleted ${user.email}`);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n  complaint.website running on http://localhost:${PORT}`);
  console.log(`  env: ${isProd ? 'production' : 'development'} · email: ${mailMode} · admin: ${adminEnabled ? 'on' : 'OFF (set ADMIN_PASSWORD)'}`);
  if (!hasEmail) {
    console.log('\n  ⚠️  Email not configured — verification codes will be printed here (dev mode).');
    console.log('      Set RESEND_API_KEY or SMTP_* in server/.env to send real emails.\n');
  } else {
    console.log('');
  }
});
