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

// --- migrations -------------------------------------------------------------
// Added after the first deploy, so they are applied defensively rather than
// being part of the CREATE TABLE above (which only runs on a fresh database).
const cols = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
if (!cols.has('activated_at')) db.exec('ALTER TABLE users ADD COLUMN activated_at INTEGER');
if (!cols.has('admin_note')) db.exec('ALTER TABLE users ADD COLUMN admin_note TEXT');
// One-click email confirmation. Stores sha256 of the token, never the token
// itself, so a leaked database cannot be used to confirm anyone's address.
// sha256 (not bcrypt) is right here: the token is 256 bits of entropy, so
// there is nothing to brute-force, and it lets us look the row up by hash.
if (!cols.has('verify_token')) db.exec('ALTER TABLE users ADD COLUMN verify_token TEXT');
if (!cols.has('verify_token_expires')) db.exec('ALTER TABLE users ADD COLUMN verify_token_expires INTEGER');
db.exec('CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users(verify_token)');

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
  markVerified: db.prepare(`UPDATE users SET email_verified = 1, otp_hash = NULL, otp_expires = NULL,
    otp_attempts = 0, verify_token = NULL, verify_token_expires = NULL, verified_at = ? WHERE email = ?`),

  byVerifyToken: db.prepare('SELECT * FROM users WHERE verify_token = ?'),
  setVerifyToken: db.prepare('UPDATE users SET verify_token = ?, verify_token_expires = ? WHERE email = ?'),

  // --- admin ---
  // otp_hash / password_hash are deliberately never selected here.
  listUsers: db.prepare(`SELECT id, name, email, phone, plan, plan_status, email_verified,
      created_at, verified_at, activated_at, admin_note
    FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`),
  countUsers: db.prepare('SELECT COUNT(*) AS n FROM users'),
  stats: db.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) AS verified,
      SUM(CASE WHEN plan_status = 'active' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN plan_status != 'active' THEN 1 ELSE 0 END) AS pending
    FROM users`),
  setStatus: db.prepare('UPDATE users SET plan_status = ?, activated_at = ? WHERE id = ?'),
  setNote: db.prepare('UPDATE users SET admin_note = ? WHERE id = ?'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?')
};

module.exports = {
  getUserByEmail: (email) => q.byEmail.get(email),
  getUserById: (id) => q.byId.get(id),
  createUser: (u) => q.insert.run(u),
  updateUnverified: (u) => q.updateUnverified.run(u),
  setOtp: (email, hash, expires, lastSent) => q.setOtp.run(hash, expires, lastSent, email),
  incOtpAttempts: (email) => q.incAttempts.run(email),
  markVerified: (email, ts) => q.markVerified.run(ts, email),
  getUserByVerifyToken: (tokenHash) => q.byVerifyToken.get(tokenHash),
  setVerifyToken: (email, tokenHash, expires) => q.setVerifyToken.run(tokenHash, expires, email),

  // --- admin ---
  listUsers: (limit, offset) => q.listUsers.all(limit, offset),
  countUsers: () => q.countUsers.get().n,
  stats: () => q.stats.get(),
  setStatus: (id, status, ts) => q.setStatus.run(status, ts, id),
  setNote: (id, note) => q.setNote.run(note, id),
  deleteUser: (id) => q.deleteUser.run(id),

  // Exposed so the session store can share this one connection.
  raw: db
};
