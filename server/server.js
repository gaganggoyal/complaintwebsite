// complaint.website — registration + email-OTP authentication server
// An IndiaOffers.in Company
require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const { sendOtpEmail, hasSmtp } = require('./mailer');

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

// ---------- middleware ----------
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  SESSION_SECRET is not set in .env — using a temporary secret (sessions reset on restart).');
}
app.use(session({
  name: 'cw.sid',
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

    const result = await sendOtpEmail(email, name, otp);
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
    if (user.email_verified) { req.session.userId = user.id; return res.json({ ok: true }); }

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
    req.session.userId = user.id;
    delete req.session.pendingEmail;
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

    const result = await sendOtpEmail(email, user.name, otp);
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
      const result = await sendOtpEmail(email, user.name, otp);
      req.session.pendingEmail = email;
      return res.status(403).json({ error: 'Please verify your email first — we just sent you a code.', needVerify: true, email, devMode: !!result.devMode });
    }

    req.session.userId = user.id;
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

app.listen(PORT, () => {
  console.log(`\n  complaint.website running on http://localhost:${PORT}\n`);
  if (!hasSmtp) {
    console.log('  ⚠️  SMTP not configured — verification codes will be printed here (dev mode).');
    console.log('      Configure server/.env to send real emails.\n');
  }
});
