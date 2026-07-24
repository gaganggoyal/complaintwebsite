// SQLite data layer for complaint.website
// One local file database (server/data/app.db) — no external DB server needed.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  email          TEXT    NOT NULL UNIQUE,
  phone          TEXT    NOT NULL,
  password_hash  TEXT    NOT NULL,
  plan           TEXT    NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  plan_status    TEXT    NOT NULL DEFAULT 'pending',
  otp_hash       TEXT,
  otp_expires    INTEGER,
  otp_attempts   INTEGER NOT NULL DEFAULT 0,
  otp_last_sent  INTEGER,
  created_at     INTEGER NOT NULL,
  verified_at    INTEGER
);
`);

const q = {
  byEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  byId: db.prepare('SELECT * FROM users WHERE id = ?'),
  insert: db.prepare(`INSERT INTO users
    (name, email, phone, password_hash, plan, otp_hash, otp_expires, otp_last_sent, otp_attempts, created_at)
    VALUES (@name, @email, @phone, @password_hash, @plan, @otp_hash, @otp_expires, @otp_last_sent, 0, @created_at)`),
  updateUnverified: db.prepare(`UPDATE users SET
    name = @name, phone = @phone, password_hash = @password_hash, plan = @plan,
    otp_hash = @otp_hash, otp_expires = @otp_expires, otp_last_sent = @otp_last_sent, otp_attempts = 0
    WHERE email = @email`),
  setOtp: db.prepare('UPDATE users SET otp_hash = ?, otp_expires = ?, otp_last_sent = ?, otp_attempts = 0 WHERE email = ?'),
  incAttempts: db.prepare('UPDATE users SET otp_attempts = otp_attempts + 1 WHERE email = ?'),
  markVerified: db.prepare('UPDATE users SET email_verified = 1, otp_hash = NULL, otp_expires = NULL, otp_attempts = 0, verified_at = ? WHERE email = ?')
};

module.exports = {
  getUserByEmail: (email) => q.byEmail.get(email),
  getUserById: (id) => q.byId.get(id),
  createUser: (u) => q.insert.run(u),
  updateUnverified: (u) => q.updateUnverified.run(u),
  setOtp: (email, hash, expires, lastSent) => q.setOtp.run(hash, expires, lastSent, email),
  incOtpAttempts: (email) => q.incAttempts.run(email),
  markVerified: (email, ts) => q.markVerified.run(ts, email)
};
