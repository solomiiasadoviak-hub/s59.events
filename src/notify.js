'use strict';
/* Delivers a new enquiry to the CRM webhook, Telegram and email. Every channel is optional. */
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {}

const LABELS = {
  name: "Ім'я",
  email: 'Email',
  phone: 'Телефон',
  company: 'Компанія',
  contactPref: 'Зручний звʼязок',
  eventTypeLabel: 'Тип події',
  date: 'Дата',
  guests: 'Гостей',
  guestsExact: 'Гостей (калькулятор)',
  location: 'Локація',
  venue: 'Площадка',
  packageLabel: 'Пакет',
  budget: 'Бюджет',
  estimate: 'Розрахунок',
  source: 'Джерело',
  vision: 'Опис',
};

function summary({ id, lang, data, test }) {
  const lines = [`${test ? '🧪 ТЕСТ · ' : ''}Нова заявка S59 #${id} (${(lang || '').toUpperCase()})`, ''];
  for (const [k, label] of Object.entries(LABELS)) if (data[k]) lines.push(`${label}: ${data[k]}`);
  return lines.join('\n');
}

async function webhook(s, e) {
  const url = s.integrations.webhookUrl;
  if (!url) return null;
  const headers = { 'Content-Type': 'application/json' };
  if (s.integrations.webhookSecret) headers['X-S59-Secret'] = s.integrations.webhookSecret;
  const body = JSON.stringify({ event: e.test ? 'enquiry.test' : 'enquiry.created', id: e.id, lang: e.lang, created_at: new Date().toISOString(), source: 's59-website', ...e.data });
  const r = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
  return `CRM webhook: ${r.status}`;
}

async function telegram(s, e) {
  const { telegramToken: t, telegramChatId: chat } = s.integrations;
  if (!t || !chat) return null;
  const r = await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: summary(e).slice(0, 4000) }),
    signal: AbortSignal.timeout(10000),
  });
  return `Telegram: ${r.status}`;
}

async function email(s, e) {
  const m = s.integrations.smtp;
  if (!nodemailer || !m.host || !m.user || !m.pass) return null;
  const tx = nodemailer.createTransport({ host: m.host, port: Number(m.port) || 465, secure: Number(m.port) === 465, auth: { user: m.user, pass: m.pass } });
  const from = m.from || m.user;
  const to = m.to || s.contacts.email || m.user;
  const out = [];
  await tx.sendMail({ from, to, replyTo: e.data.email, subject: `${e.test ? '[TEST] ' : ''}S59 · Нова заявка #${e.id} — ${e.data.name || ''}`, text: summary(e) });
  out.push('Email: sent');
  if (m.autoReply && !e.test && e.data.email && e.content && e.content.contactPage.autoReply) {
    const ar = e.content.contactPage.autoReply;
    await tx.sendMail({ from, to: e.data.email, subject: ar.subject, text: String(ar.body).replace(/\{name\}/g, e.data.name || '') });
    out.push('auto-reply: sent');
  }
  return out.join(', ');
}

async function all(s, e) {
  const results = await Promise.allSettled([webhook(s, e), telegram(s, e), email(s, e)]);
  const names = ['CRM webhook', 'Telegram', 'Email'];
  const log = results
    .map((r, i) => (r.status === 'fulfilled' ? r.value : `${names[i]}: помилка — ${r.reason && r.reason.message}`))
    .filter(Boolean);
  return log.length ? log.join(' · ') : 'Сповіщення не налаштовані';
}

module.exports = { all, summary };
