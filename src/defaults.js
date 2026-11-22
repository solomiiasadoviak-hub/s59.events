'use strict';

const LANGS = ['en', 'pl', 'uk', 'ru'];
const LANG_LABELS = { en: 'EN', pl: 'PL', uk: 'UA', ru: 'RU' };

const SERVICE_SLUGS = [
  'private-celebrations',
  'weddings-engagements',
  'childrens-celebrations',
  'corporate-events',
  'brand-lifestyle-events',
];

const HOME_SECTIONS = [
  { key: 'intro', on: true },
  { key: 'categories', on: true },
  { key: 'philosophy', on: true },
  { key: 'why', on: true },
  { key: 'approach', on: true },
  { key: 'packages', on: true },
  { key: 'calculator', on: true },
  { key: 'quote', on: true },
  { key: 'portfolio', on: true },
  { key: 'testimonials', on: true },
  { key: 'instagram', on: true },
  { key: 'cta', on: true },
];

const settings = {
  contacts: {
    phone: '+48 512 479 118',
    whatsapp: '48512479118',
    email: '',
    instagramUrl: 'https://www.instagram.com/s59.events/',
    instagramHandle: 's59.events',
    telegram: '',
    showWhatsappButton: true,
  },
  company: { legalName: '', nip: '', address: '' },
  languages: { enabled: LANGS.slice(), default: 'en' },
  theme: {
    colors: { bg: '#1F1711', bg2: '#2D241D', ink: '#000000', sand: '#CDC7B2', stone: '#A89982', white: '#FFFFFF' },
    fonts: {
      heading: 'Cormorant Infant',
      headingAxes: 'ital,wght@0,300;0,400;0,500;1,300;1,400',
      body: 'Assistant',
      bodyAxes: 'wght@300;400;600',
      fallback: 'Jost',
      fallbackAxes: 'wght@300;400;500',
    },
    logo: '/img/logo.png',
    logoHeight: 56,
    headingCase: 'uppercase',
    headingScale: 1,
    customCss: '',
  },
  media: {
    heroImage: '/img/leather.jpg',
    heroVideo: '',
    aboutImage: '/img/leather.jpg',
    founderImage: '',
    ctaImage: '',
    ogImage: '/img/leather.jpg',
    serviceImages: {},
  },
  homeSections: HOME_SECTIONS,
  calculator: {
    enabled: true,
    currency: 'PLN',
    spread: 0.25,
    minGuests: 10,
    maxGuests: 300,
    defaultGuests: 40,
    types: {
      'private-celebrations': { base: 9000, perGuest: 380 },
      'weddings-engagements': { base: 28000, perGuest: 480 },
      'childrens-celebrations': { base: 7000, perGuest: 260 },
      'corporate-events': { base: 16000, perGuest: 420 },
      'brand-lifestyle-events': { base: 22000, perGuest: 450 },
    },
    packages: { signature: 1, exclusive: 1.5, bespoke: 2.3 },
    extras: [
      { key: 'media', price: 4500, perGuest: false, label: { en: 'Photo & video production', pl: 'Fotografia i wideo', uk: 'Фото- та відеозйомка', ru: 'Фото- и видеосъёмка' } },
      { key: 'music', price: 6000, perGuest: false, label: { en: 'Live music & artists', pl: 'Muzyka na żywo i artyści', uk: 'Жива музика та артисти', ru: 'Живая музыка и артисты' } },
      { key: 'florals', price: 5000, perGuest: false, label: { en: 'Premium floral design', pl: 'Florystyka premium', uk: 'Преміальна флористика', ru: 'Премиальная флористика' } },
      { key: 'gifts', price: 120, perGuest: true, label: { en: 'Welcome gifts for every guest', pl: 'Upominki powitalne dla gości', uk: 'Welcome gifts для кожного гостя', ru: 'Welcome gifts для каждого гостя' } },
      { key: 'transfer', price: 3500, perGuest: false, label: { en: 'Guest transfers', pl: 'Transfery dla gości', uk: 'Трансфер для гостей', ru: 'Трансфер для гостей' } },
    ],
  },
  integrations: {
    webhookUrl: '',
    webhookSecret: '',
    telegramToken: '',
    telegramChatId: '',
    smtp: { host: '', port: 465, user: '', pass: '', from: '', to: '', autoReply: false },
  },
  seo: { siteUrl: '', customHead: '', noindex: false },
  cookieBanner: false,
  security: { passwordHash: '' },
};

const testimonials = [];
const projects = [];

module.exports = { LANGS, LANG_LABELS, SERVICE_SLUGS, HOME_SECTIONS, settings, testimonials, projects };
