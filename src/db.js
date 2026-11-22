'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.resolve(
  process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data')
);
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 's59.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    lang TEXT,
    data TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    notify TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const now = () => new Date().toISOString();
const cache = new Map();

function getDoc(key, fallback) {
  if (cache.has(key)) return cache.get(key);
  const row = db.prepare('SELECT value FROM docs WHERE key = ?').get(key);
  const value = row ? JSON.parse(row.value) : fallback;
  if (row) cache.set(key, value);
  return value;
}

function setDoc(key, value) {
  db.prepare(
    'INSERT INTO docs (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, JSON.stringify(value), now());
  cache.set(key, value);
  return value;
}

function hasDoc(key) {
  return !!db.prepare('SELECT 1 FROM docs WHERE key = ?').get(key);
}

/* Fill keys that exist in defaults but not in stored data (objects only; arrays are kept as the owner left them). */
function mergeMissing(stored, defaults) {
  if (Array.isArray(defaults) || defaults === null || typeof defaults !== 'object') return stored === undefined ? defaults : stored;
  if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return stored === undefined ? defaults : stored;
  const out = { ...stored };
  for (const k of Object.keys(defaults)) out[k] = k in stored ? mergeMissing(stored[k], defaults[k]) : defaults[k];
  return out;
}

const enquiries = {
  create(lang, data) {
    const r = db.prepare('INSERT INTO enquiries (created_at, lang, data) VALUES (?, ?, ?)').run(now(), lang, JSON.stringify(data));
    return Number(r.lastInsertRowid);
  },
  list() {
    return db.prepare('SELECT * FROM enquiries ORDER BY id DESC').all().map(parseEnquiry);
  },
  get(id) {
    const r = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(id);
    return r ? parseEnquiry(r) : null;
  },
  update(id, { status, notes }) {
    if (status !== undefined) db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(String(status), id);
    if (notes !== undefined) db.prepare('UPDATE enquiries SET notes = ? WHERE id = ?').run(String(notes), id);
  },
  setNotify(id, text) {
    db.prepare('UPDATE enquiries SET notify = ? WHERE id = ?').run(text, id);
  },
  remove(id) {
    db.prepare('DELETE FROM enquiries WHERE id = ?').run(id);
  },
  countNew() {
    return db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'").get().n;
  },
};
function parseEnquiry(r) {
  return { ...r, data: JSON.parse(r.data) };
}

const media = {
  add(m) {
    const r = db.prepare('INSERT INTO media (filename, original, mime, size, created_at) VALUES (?, ?, ?, ?, ?)').run(m.filename, m.original, m.mime, m.size, now());
    return Number(r.lastInsertRowid);
  },
  list() {
    return db.prepare('SELECT * FROM media ORDER BY id DESC').all().map((m) => ({ ...m, url: '/uploads/' + m.filename }));
  },
  get(id) {
    return db.prepare('SELECT * FROM media WHERE id = ?').get(id);
  },
  remove(id) {
    const m = media.get(id);
    if (!m) return;
    db.prepare('DELETE FROM media WHERE id = ?').run(id);
    fs.rm(path.join(UPLOAD_DIR, m.filename), { force: true }, () => {});
  },
};

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  let s = getDoc('secret', null);
  if (!s) s = setDoc('secret', crypto.randomBytes(32).toString('hex'));
  return s;
}

module.exports = { db, DATA_DIR, UPLOAD_DIR, getDoc, setDoc, hasDoc, mergeMissing, enquiries, media, secret };
