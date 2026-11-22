'use strict';
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');

const store = require('./src/db');
const defaults = require('./src/defaults');
const render = require('./src/render');
const notify = require('./src/notify');

const { LANGS } = defaults;
const VERSION = require('./package.json').version + '-' + Date.now().toString(36);
const PORT = Number(process.env.PORT) || 3000;
const PROD = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

/* ---------------- data access ---------------- */
const seedContent = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(__dirname, 'src/content', l + '.json'), 'utf8'))]));

function getSettings() {
  return store.mergeMissing(store.getDoc('settings', null) || {}, defaults.settings);
}
function getContent(lang) {
  return store.mergeMissing(store.getDoc('content:' + lang, null) || {}, seedContent[lang]);
}
const getList = (key) => store.getDoc(key, []) || [];

// first run: persist defaults so the admin edits real documents
if (!store.hasDoc('settings')) store.setDoc('settings', defaults.settings);
for (const l of LANGS) if (!store.hasDoc('content:' + l)) store.setDoc('content:' + l, seedContent[l]);
if (!store.hasDoc('testimonials')) store.setDoc('testimonials', defaults.testimonials);
if (!store.hasDoc('projects')) store.setDoc('projects', defaults.projects);

/* ---------------- app ---------------- */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: PROD ? '7d' : 0 }));
app.use('/img', express.static(path.join(__dirname, 'public/img'), { maxAge: PROD ? '7d' : 0 }));
app.use('/uploads', express.static(store.UPLOAD_DIR, { maxAge: PROD ? '30d' : 0 }));
app.use('/admin/static', express.static(path.join(__dirname, 'admin'), { maxAge: 0 }));

app.get('/healthz', (req, res) => res.json({ ok: true }));

function baseUrl(req, s) {
  return (s.seo.siteUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function ctxFor(req, lang) {
  const s = getSettings();
  const pub = (list) => list.filter((x) => x.published !== false);
  return {
    lang,
    c: getContent(lang),
    s,
    baseUrl: baseUrl(req, s),
    version: VERSION,
    testimonials: pub(getList('testimonials')),
    projects: pub(getList('projects')),
  };
}

function pickLang(req, s) {
  const enabled = s.languages.enabled.length ? s.languages.enabled : LANGS;
  const cookie = /(?:^|;\s*)lang=([a-z]{2})/.exec(req.headers.cookie || '');
  if (cookie && enabled.includes(cookie[1])) return cookie[1];
  const al = String(req.headers['accept-language'] || '').toLowerCase();
  const prefs = al.split(',').map((x) => x.split(';')[0].trim().slice(0, 2));
  for (const p of prefs) {
    const l = p === 'ua' ? 'uk' : p;
    if (enabled.includes(l)) return l;
  }
  return enabled.includes(s.languages.default) ? s.languages.default : enabled[0];
}

app.get('/', (req, res) => res.redirect(302, '/' + pickLang(req, getSettings()) + '/'));

app.get('/robots.txt', (req, res) => {
  const s = getSettings();
  res.type('text/plain').send(s.seo.noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nDisallow: /admin\nDisallow: /api\nSitemap: ${baseUrl(req, s)}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const s = getSettings();
  const b = baseUrl(req, s);
  const paths = ['/', '/about', '/services', '/packages', '/approach', '/faq', '/enquire', '/privacy-policy'];
  if (s.calculator.enabled) paths.push('/estimate');
  const c = getContent(s.languages.default);
  c.services.forEach((sv) => paths.push('/services/' + sv.slug));
  const projects = getList('projects').filter((p) => p.published !== false);
  if (projects.length) paths.push('/portfolio', ...projects.map((p) => '/portfolio/' + p.slug));
  const urls = [];
  for (const p of paths)
    for (const l of s.languages.enabled)
      urls.push(`<url><loc>${b}/${l}${p}</loc>${s.languages.enabled.map((x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${b}/${x}${p}"/>`).join('')}</url>`);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`);
});

/* ---------------- public pages ---------------- */
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const parts = req.path.split('/').filter(Boolean);
  if (!parts.length || !LANGS.includes(parts[0])) return next();
  const s = getSettings();
  const lang = parts[0];
  if (!s.languages.enabled.includes(lang)) return res.redirect(302, '/' + s.languages.default + '/');
  if (req.path === '/' + lang) return res.redirect(301, '/' + lang + '/');
  const ctx = ctxFor(req, lang);
  const rest = parts.slice(1);
  const q = req.query || {};
  res.setHeader('Cache-Control', 'no-cache');
  res.cookie('lang', lang, { maxAge: 31536000000, sameSite: 'lax' });
  const send = (html, code = 200) => res.status(code).type('html').send(html);
  const page = rest.join('/');
  try {
    if (page === '') return send(render.home(ctx));
    if (page === 'about') return send((ctx.active = 'about', render.about(ctx)));
    if (page === 'services') return send((ctx.active = 'services', render.servicesIndex(ctx)));
    if (rest[0] === 'services' && rest.length === 2) {
      const sv = ctx.c.services.find((x) => x.slug === rest[1]);
      if (sv) return send((ctx.active = 'services', render.service(ctx, sv)));
    }
    if (page === 'packages') return send((ctx.active = 'packages', render.packages(ctx)));
    if (page === 'approach') return send((ctx.active = 'approach', render.approach(ctx)));
    if (page === 'portfolio') return send((ctx.active = 'portfolio', render.portfolio(ctx)));
    if (rest[0] === 'portfolio' && rest.length === 2) {
      const pr = ctx.projects.find((x) => x.slug === rest[1]);
      if (pr) return send((ctx.active = 'portfolio', render.project(ctx, pr)));
    }
    if (page === 'faq') return send(render.faq(ctx));
    if (page === 'estimate' && ctx.s.calculator.enabled) return send((ctx.active = 'calculator', render.calculator(ctx, q)));
    if (page === 'enquire') return send(render.enquire(ctx, q));
    if (page === 'enquire/thank-you') return send(render.thanks(ctx));
    if (page === 'privacy-policy') return send(render.legal(ctx, 'privacy', '/privacy-policy'));
    if (page === 'cookie-policy') return send(render.legal(ctx, 'cookies', '/cookie-policy'));
    if (page === 'terms') return send(render.legal(ctx, 'terms', '/terms'));
    return send(render.notFound(ctx), 404);
  } catch (e) {
    console.error('render error', req.path, e);
    return res.status(500).type('text').send('Internal error');
  }
});

/* ---------------- enquiries ---------------- */
const hits = new Map();
function rateLimited(key, max, windowMs) {
  const t = Date.now();
  const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
  arr.push(t);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

const FIELDS = ['name', 'email', 'phone', 'company', 'contactPref', 'eventType', 'date', 'guests', 'guestsExact', 'location', 'venue', 'package', 'budget', 'vision', 'source', 'estimate'];

app.post('/api/enquiry', express.urlencoded({ extended: false, limit: '50kb' }), express.json({ limit: '50kb' }), (req, res) => {
  const b = req.body || {};
  const s = getSettings();
  const lang = LANGS.includes(b.lang) ? b.lang : s.languages.default;
  const wantsJson = (req.get('accept') || '').includes('application/json');
  const fail = (code, msg) => (wantsJson ? res.status(code).json({ ok: false, error: msg }) : res.status(code).type('text').send(msg));

  if (b.website) return wantsJson ? res.json({ ok: true }) : res.redirect(303, `/${lang}/enquire/thank-you`); // honeypot
  if (rateLimited('enq:' + req.ip, 6, 10 * 60 * 1000)) return fail(429, 'Too many requests');

  const data = {};
  for (const f of FIELDS) if (b[f] !== undefined) data[f] = String(b[f]).trim().slice(0, f === 'vision' ? 5000 : 300);
  if (!data.name || !data.email || !data.phone || !data.vision || !data.eventType || !data.date || !b.consent)
    return fail(400, 'Missing required fields');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return fail(400, 'Invalid email');

  const c = getContent(lang);
  const sv = c.services.find((x) => x.slug === data.eventType);
  data.eventTypeLabel = sv ? sv.title : data.eventType;
  const pk = c.packagesPage.packages.find((x) => x.key === data.package);
  if (pk) data.packageLabel = pk.name;
  data.consent = true;
  data.page = String(req.get('referer') || '').slice(0, 300);

  const id = store.enquiries.create(lang, data);
  notify
    .all(s, { id, lang, data, content: c })
    .then((log) => store.enquiries.setNotify(id, log))
    .catch((e) => store.enquiries.setNotify(id, 'error: ' + e.message));

  if (wantsJson) return res.json({ ok: true, id });
  res.redirect(303, `/${lang}/enquire/thank-you`);
});

/* ---------------- admin auth ---------------- */
function sign(payload) {
  return crypto.createHmac('sha256', store.secret()).update(payload).digest('base64url');
}
function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 7 * 24 * 3600 * 1000 })).toString('base64url');
  return payload + '.' + sign(payload);
}
function validToken(t) {
  if (!t || !t.includes('.')) return false;
  const [payload, sig] = t.split('.');
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}
function readCookie(req, name) {
  const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]+)').exec(req.headers.cookie || '');
  return m ? decodeURIComponent(m[1]) : '';
}
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPassword(pw) {
  const s = getSettings();
  const stored = s.security.passwordHash;
  if (stored) {
    const [salt, hash] = stored.split(':');
    const got = crypto.scryptSync(pw, salt, 64);
    return crypto.timingSafeEqual(got, Buffer.from(hash, 'hex'));
  }
  const env = process.env.ADMIN_PASSWORD;
  if (!env) return null;
  const a = Buffer.from(pw);
  const b = Buffer.from(env);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const api = express.Router();
api.use(express.json({ limit: '20mb' }));

api.post('/login', (req, res) => {
  if (rateLimited('login:' + req.ip, 10, 15 * 60 * 1000)) return res.status(429).json({ error: 'Забагато спроб. Спробуйте через 15 хвилин.' });
  const ok = checkPassword(String((req.body || {}).password || ''));
  if (ok === null) return res.status(503).json({ error: 'Пароль адміністратора не задано. Додайте змінну ADMIN_PASSWORD у Railway → Variables.' });
  if (!ok) return res.status(401).json({ error: 'Невірний пароль' });
  res.cookie('s59admin', makeToken(), { httpOnly: true, sameSite: 'strict', secure: PROD, maxAge: 7 * 24 * 3600 * 1000, path: '/' });
  res.json({ ok: true });
});
api.post('/logout', (req, res) => {
  res.clearCookie('s59admin', { path: '/' });
  res.json({ ok: true });
});

api.use((req, res, next) => {
  if (!validToken(readCookie(req, 's59admin'))) return res.status(401).json({ error: 'auth' });
  if (req.method !== 'GET' && req.get('x-s59') !== '1') return res.status(403).json({ error: 'csrf' });
  next();
});

api.get('/state', (req, res) => {
  res.json({
    settings: getSettings(),
    langs: LANGS,
    serviceSlugs: getContent(getSettings().languages.default).services.map((x) => ({ slug: x.slug, title: x.title })),
    newEnquiries: store.enquiries.countNew(),
    dataDir: store.DATA_DIR,
    persistent: !!(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR),
  });
});

api.put('/settings', (req, res) => {
  const incoming = req.body || {};
  const current = getSettings();
  incoming.security = current.security; // password only via /password
  store.setDoc('settings', store.mergeMissing(incoming, defaults.settings));
  res.json({ ok: true });
});

api.get('/content/:lang', (req, res) => {
  if (!LANGS.includes(req.params.lang)) return res.status(404).end();
  res.json(getContent(req.params.lang));
});
api.put('/content/:lang', (req, res) => {
  if (!LANGS.includes(req.params.lang)) return res.status(404).end();
  store.setDoc('content:' + req.params.lang, req.body);
  res.json({ ok: true });
});
api.get('/content-default/:lang', (req, res) => {
  if (!LANGS.includes(req.params.lang)) return res.status(404).end();
  res.json(seedContent[req.params.lang]);
});

for (const key of ['testimonials', 'projects']) {
  api.get('/' + key, (req, res) => res.json(getList(key)));
  api.put('/' + key, (req, res) => {
    if (!Array.isArray(req.body)) return res.status(400).json({ error: 'array expected' });
    store.setDoc(key, req.body);
    res.json({ ok: true });
  });
}

api.get('/enquiries', (req, res) => res.json(store.enquiries.list()));
api.patch('/enquiries/:id', (req, res) => {
  store.enquiries.update(Number(req.params.id), req.body || {});
  res.json({ ok: true });
});
api.delete('/enquiries/:id', (req, res) => {
  store.enquiries.remove(Number(req.params.id));
  res.json({ ok: true });
});
api.get('/enquiries.csv', (req, res) => {
  const list = store.enquiries.list();
  const cols = ['id', 'created_at', 'status', 'lang', ...FIELDS, 'notes'];
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines = [cols.join(',')].concat(list.map((e) => cols.map((cName) => q(cName in e && cName !== 'data' ? e[cName] : e.data[cName])).join(',')));
  res.setHeader('Content-Disposition', 'attachment; filename="s59-enquiries.csv"');
  res.type('text/csv').send('﻿' + lines.join('\n'));
});
api.post('/enquiries/:id/resend', async (req, res) => {
  const e = store.enquiries.get(Number(req.params.id));
  if (!e) return res.status(404).end();
  const log = await notify.all(getSettings(), { id: e.id, lang: e.lang, data: e.data, content: getContent(e.lang || 'en') });
  store.enquiries.setNotify(e.id, log);
  res.json({ ok: true, log });
});

const ALLOWED = /^(image\/(jpeg|png|webp|gif|svg\+xml|avif)|video\/(mp4|webm|quicktime)|font\/(woff2?|ttf|otf)|application\/(font-woff2?|x-font-ttf|octet-stream)|application\/pdf)$/;
const upload = multer({
  storage: multer.diskStorage({
    destination: store.UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
      cb(null, Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 300 * 1024 * 1024, files: 30 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED.test(file.mimetype) || /\.(woff2?|ttf|otf)$/i.test(file.originalname)),
});
api.get('/media', (req, res) => res.json(store.media.list()));
api.post('/media', upload.array('files'), (req, res) => {
  const added = (req.files || []).map((f) => {
    const id = store.media.add({ filename: f.filename, original: f.originalname, mime: f.mimetype, size: f.size });
    return { id, url: '/uploads/' + f.filename, original: f.originalname, mime: f.mimetype };
  });
  res.json({ ok: true, added });
});
api.delete('/media/:id', (req, res) => {
  store.media.remove(Number(req.params.id));
  res.json({ ok: true });
});

api.post('/test-notify', async (req, res) => {
  const s = getSettings();
  const log = await notify.all(s, {
    id: 0,
    lang: 'uk',
    test: true,
    data: { name: 'Тестова заявка', email: s.contacts.email || 'test@example.com', phone: s.contacts.phone, eventTypeLabel: 'Test', date: '—', vision: 'Це тестове повідомлення з адмін-панелі S59.' },
    content: getContent('en'),
  });
  res.json({ ok: true, log });
});

api.post('/password', (req, res) => {
  const { current, next } = req.body || {};
  if (!next || String(next).length < 8) return res.status(400).json({ error: 'Новий пароль має містити щонайменше 8 символів' });
  if (!checkPassword(String(current || ''))) return res.status(401).json({ error: 'Поточний пароль невірний' });
  const s = getSettings();
  s.security = { passwordHash: hashPassword(String(next)) };
  store.setDoc('settings', s);
  res.json({ ok: true });
});

api.get('/backup', (req, res) => {
  const s = getSettings();
  const out = {
    version: 1,
    exported_at: new Date().toISOString(),
    settings: { ...s, security: { passwordHash: '' } },
    content: Object.fromEntries(LANGS.map((l) => [l, getContent(l)])),
    testimonials: getList('testimonials'),
    projects: getList('projects'),
    enquiries: store.enquiries.list(),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="s59-backup.json"');
  res.json(out);
});
api.post('/restore', (req, res) => {
  const b = req.body || {};
  if (!b.settings || !b.content) return res.status(400).json({ error: 'Невірний файл резервної копії' });
  const cur = getSettings();
  store.setDoc('settings', { ...store.mergeMissing(b.settings, defaults.settings), security: cur.security });
  for (const l of LANGS) if (b.content[l]) store.setDoc('content:' + l, b.content[l]);
  if (Array.isArray(b.testimonials)) store.setDoc('testimonials', b.testimonials);
  if (Array.isArray(b.projects)) store.setDoc('projects', b.projects);
  res.json({ ok: true });
});

app.use('/admin/api', api);
app.get(['/admin', '/admin/'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

/* ---------------- fallbacks ---------------- */
app.use((req, res) => {
  const s = getSettings();
  const lang = pickLang(req, s);
  res.status(404).type('html').send(render.notFound(ctxFor(req, lang)));
});
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'error' });
});

app.listen(PORT, () => {
  console.log(`S59 site running on :${PORT} · data: ${store.DATA_DIR}`);
  if (!process.env.ADMIN_PASSWORD && !getSettings().security.passwordHash) console.warn('⚠ ADMIN_PASSWORD is not set — admin login is disabled.');
});
