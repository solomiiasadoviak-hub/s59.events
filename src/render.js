'use strict';
const { LANG_LABELS } = require('./defaults');

/* ---------------- helpers ---------------- */
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// *italic*, **bold**, line breaks
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
const rich = (s) =>
  String(s ?? '')
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => '<p>' + inline(p.trim()) + '</p>')
    .join('');
const plain = (s) => String(s ?? '').replace(/\*/g, '');
const tr = (obj, lang) => (obj && typeof obj === 'object' ? obj[lang] || obj.en || Object.values(obj).find(Boolean) || '' : obj || '');
const pad = (n) => String(n).padStart(2, '0');
const attr = (s) => esc(s);
const isVideo = (u) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u || '');

function fontsHref(f) {
  const fam = (name, axes) => (name ? 'family=' + encodeURIComponent(name.trim()).replace(/%20/g, '+') + (axes ? ':' + axes : '') : '');
  const parts = [fam(f.heading, f.headingAxes), fam(f.body, f.bodyAxes), fam(f.fallback, f.fallbackAxes)].filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.length ? 'https://fonts.googleapis.com/css2?' + unique.join('&') + '&display=swap' : '';
}

/* ---------------- layout ---------------- */
function layout(ctx, { title, titleOverride, description, body, path = '', ogImage, transparentHeader = false, noindex = false }) {
  const { lang, c, s } = ctx;
  const th = s.theme;
  const col = th.colors;
  const fonts = th.fonts;
  const base = ctx.baseUrl;
  const fullTitle = titleOverride ? plain(titleOverride) : title ? plain(title) + (c.meta.titleSuffix || '') : plain(c.meta.siteName);
  const langs = s.languages.enabled;
  const fh = `"${fonts.heading}", "Cormorant Garamond", Garamond, serif`;
  const fb = `"${fonts.body}"${fonts.fallback ? `, "${fonts.fallback}"` : ''}, "Helvetica Neue", Arial, sans-serif`;
  const og = ogImage || s.media.ogImage;
  const nav = navItems(ctx);
  const href = fontsHref(fonts);

  return `<!doctype html>
<html lang="${lang === 'uk' ? 'uk' : lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${attr(plain(description || c.home.seo.description))}">
${noindex || s.seo.noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${attr(base + '/' + lang + path)}">
${langs.map((l) => `<link rel="alternate" hreflang="${l}" href="${attr(base + '/' + l + path)}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${attr(base + '/' + s.languages.default + path)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${attr(c.meta.siteName)}">
<meta property="og:title" content="${attr(fullTitle)}">
<meta property="og:description" content="${attr(plain(description || c.home.seo.description))}">
${og ? `<meta property="og:image" content="${attr(og.startsWith('http') ? og : base + og)}">` : ''}
<meta name="theme-color" content="${attr(col.bg)}">
<link rel="icon" href="${attr(th.logo)}">
${href ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${attr(href)}">` : ''}
<style>:root{--bg:${col.bg};--bg2:${col.bg2};--ink:${col.ink};--sand:${col.sand};--stone:${col.stone};--white:${col.white};--fh:${fh};--fb:${fb};--hcase:${th.headingCase === 'none' ? 'none' : 'uppercase'};--hscale:${Number(th.headingScale) || 1};--logo-h:${Number(th.logoHeight) || 56}px}</style>
<link rel="stylesheet" href="/assets/css/site.css?v=${ctx.version}">
${th.customCss ? `<style>${th.customCss.replace(/<\/style/gi, '')}</style>` : ''}
${s.seo.customHead || ''}
</head>
<body class="${transparentHeader ? 'has-hero' : ''}">
<a class="skip" href="#main">${esc(c.ui.skip)}</a>
<header class="hdr${transparentHeader ? ' hdr--over' : ''}" id="hdr">
  <div class="hdr__in">
    <a class="hdr__logo" href="/${lang}/" aria-label="${attr(c.meta.siteName)}"><img src="${attr(th.logo)}" alt="${attr(c.meta.siteName)}"></a>
    <nav class="hdr__nav" aria-label="Main">
      ${nav.map((n) => `<a href="${n.href}"${ctx.active === n.key ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('')}
    </nav>
    <div class="hdr__right">
      ${langs.length > 1 ? `<div class="langs">${langs.map((l) => `<a href="/${l}${path}" hreflang="${l}"${l === lang ? ' aria-current="true"' : ''}>${LANG_LABELS[l]}</a>`).join('')}</div>` : ''}
      <a class="btn btn--line btn--sm hdr__cta" href="/${lang}/enquire">${esc(c.nav.enquire)}</a>
      <button class="burger" id="burger" aria-expanded="false" aria-controls="drawer"><span></span><span></span><span class="sr">${esc(c.nav.menu)}</span></button>
    </div>
  </div>
</header>
<div class="drawer" id="drawer" hidden>
  <nav aria-label="Mobile">
    ${nav.map((n) => `<a href="${n.href}">${esc(n.label)}</a>`).join('')}
    <a href="/${lang}/enquire">${esc(c.nav.enquire)}</a>
  </nav>
  ${langs.length > 1 ? `<div class="langs langs--drawer">${langs.map((l) => `<a href="/${l}${path}"${l === lang ? ' aria-current="true"' : ''}>${LANG_LABELS[l]}</a>`).join('')}</div>` : ''}
  <div class="drawer__contact">${contactLines(ctx)}</div>
</div>
<main id="main">
${body}
</main>
${footer(ctx)}
${s.contacts.showWhatsappButton && s.contacts.whatsapp ? `<a class="wa" href="https://wa.me/${attr(String(s.contacts.whatsapp).replace(/\D/g, ''))}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg></a>` : ''}
${s.cookieBanner ? `<div class="cookie" id="cookie" hidden><p>${esc(c.ui.cookieText)} <a href="/${lang}/cookie-policy">${esc(c.footer.cookies)}</a></p><button class="btn btn--solid btn--sm" id="cookieOk">${esc(c.ui.cookieAccept)}</button></div>` : ''}
<script src="/assets/js/site.js?v=${ctx.version}" defer></script>
</body>
</html>`;
}

function navItems(ctx) {
  const { lang, c, s } = ctx;
  const items = [
    { key: 'about', href: `/${lang}/about`, label: c.nav.about },
    { key: 'services', href: `/${lang}/services`, label: c.nav.services },
    { key: 'packages', href: `/${lang}/packages`, label: c.nav.packages },
    { key: 'approach', href: `/${lang}/approach`, label: c.nav.approach },
  ];
  if (ctx.projects.length) items.push({ key: 'portfolio', href: `/${lang}/portfolio`, label: c.nav.portfolio });
  if (s.calculator.enabled) items.push({ key: 'calculator', href: `/${lang}/estimate`, label: c.nav.calculator });
  return items;
}

function contactLines(ctx) {
  const k = ctx.s.contacts;
  const out = [];
  if (k.phone) out.push(`<a href="tel:${attr(k.phone.replace(/[^\d+]/g, ''))}">${esc(k.phone)}</a>`);
  if (k.email) out.push(`<a href="mailto:${attr(k.email)}">${esc(k.email)}</a>`);
  if (k.instagramUrl) out.push(`<a href="${attr(k.instagramUrl)}" target="_blank" rel="noopener">@${esc(k.instagramHandle || 'instagram')}</a>`);
  return out.join('');
}

function footer(ctx) {
  const { lang, c, s } = ctx;
  const co = s.company;
  const year = new Date().getFullYear();
  return `<footer class="ftr">
  <div class="wrap">
    <div class="ftr__top">
      <div class="ftr__brand">
        <img src="${attr(s.theme.logo)}" alt="${attr(c.meta.siteName)}">
        <p>${esc(c.footer.tagline)}</p>
      </div>
      <div class="ftr__col"><h4>${esc(c.footer.explore)}</h4>${navItems(ctx).map((n) => `<a href="${n.href}">${esc(n.label)}</a>`).join('')}<a href="/${lang}/faq">${esc(c.nav.faq)}</a><a href="/${lang}/enquire">${esc(c.nav.enquire)}</a></div>
      <div class="ftr__col"><h4>${esc(c.footer.services)}</h4>${c.services.map((sv) => `<a href="/${lang}/services/${attr(sv.slug)}">${esc(sv.title)}</a>`).join('')}</div>
      <div class="ftr__col"><h4>${esc(c.footer.contact)}</h4>${contactLines(ctx)}<span>${esc(c.contactPage.direct.studioValue)}</span></div>
    </div>
    <div class="ftr__bottom">
      <span>© ${year} ${esc(c.meta.siteName)}. ${esc(c.footer.rights)}${co.legalName ? ' · ' + esc(co.legalName) : ''}${co.nip ? ' · NIP ' + esc(co.nip) : ''}${co.address ? ' · ' + esc(co.address) : ''}</span>
      <span class="ftr__legal"><a href="/${lang}/privacy-policy">${esc(c.footer.privacy)}</a><a href="/${lang}/cookie-policy">${esc(c.footer.cookies)}</a><a href="/${lang}/terms">${esc(c.footer.terms)}</a></span>
    </div>
  </div>
</footer>`;
}

/* ---------------- shared blocks ---------------- */
const btn = (href, label, kind = 'solid') => (label ? `<a class="btn btn--${kind}" href="${attr(href)}">${esc(label)}</a>` : '');
const eyebrow = (t) => (t ? `<p class="eyebrow">${esc(t)}</p>` : '');

function pageHero(ctx, h, { image, cta } = {}) {
  if (!h) return '';
  return `<section class="phero${image ? ' phero--img' : ''}">
  ${image ? mediaBg(image) : ''}
  <div class="wrap phero__in">
    ${eyebrow(h.eyebrow)}
    <h1 class="h-xl">${inline(h.title)}</h1>
    ${h.subtitle ? `<p class="lead">${inline(h.subtitle)}</p>` : ''}
    ${cta || ''}
  </div>
</section>`;
}

function mediaBg(url, poster) {
  if (isVideo(url))
    return `<video class="bgm" src="${attr(url)}" ${poster ? `poster="${attr(poster)}"` : ''} autoplay muted loop playsinline preload="metadata"></video>`;
  return `<img class="bgm" src="${attr(url)}" alt="" fetchpriority="high">`;
}

function ctaBand(ctx, cta, href) {
  if (!cta || !cta.title) return '';
  const img = ctx.s.media.ctaImage;
  return `<section class="ctab${img ? ' ctab--img' : ''}">
  ${img ? mediaBg(img) : ''}
  <div class="wrap ctab__in">
    <h2 class="h-l">${inline(cta.title)}</h2>
    ${cta.text ? `<p class="lead">${inline(cta.text)}</p>` : ''}
    ${btn(href || `/${ctx.lang}/enquire`, cta.button, 'solid')}
  </div>
</section>`;
}

function numberedList(items, cls = '') {
  return `<ol class="nlist ${cls}">${(items || [])
    .map((it, i) => `<li><span class="nlist__n">${pad(i + 1)}</span><div><h3 class="h-s">${inline(it.title)}</h3>${it.text ? `<p>${inline(it.text)}</p>` : ''}</div></li>`)
    .join('')}</ol>`;
}

function serviceCards(ctx) {
  const { lang, c, s } = ctx;
  return `<div class="svc-grid">${c.services
    .map((sv, i) => {
      const img = s.media.serviceImages[sv.slug];
      return `<a class="svc${img ? ' svc--img' : ''}" href="/${lang}/services/${attr(sv.slug)}">
        ${img ? (isVideo(img) ? `<video src="${attr(img)}" muted loop playsinline autoplay preload="metadata"></video>` : `<img src="${attr(img)}" alt="" loading="lazy">`) : ''}
        <span class="svc__n">${pad(i + 1)}</span>
        <span class="svc__body"><span class="svc__t">${esc(sv.title)}</span><span class="svc__d">${esc(sv.short)}</span><span class="svc__more">${esc(c.common.explore)} →</span></span>
      </a>`;
    })
    .join('')}</div>`;
}

function packageCards(ctx, full) {
  const { lang, c } = ctx;
  return `<div class="pkg-grid">${c.packagesPage.packages
    .map(
      (p) => `<article class="pkg" id="${attr(p.key)}">
      <h3 class="pkg__name">${esc(p.name)}</h3>
      <p class="pkg__sub">${inline(p.subtitle)}</p>
      ${full ? `<p class="pkg__text">${inline(p.text)}</p><p class="pkg__inc">${esc(p.includesTitle)}</p><ul class="ticks">${(p.includes || []).map((x) => `<li>${inline(x)}</li>`).join('')}</ul>` : ''}
      ${btn(`/${lang}/enquire?package=${encodeURIComponent(p.key)}`, full ? p.cta : c.nav.enquire, 'line')}
    </article>`
    )
    .join('')}</div>`;
}

function testimonialsBlock(ctx, head) {
  const list = ctx.testimonials;
  if (!list.length) return '';
  return `<section class="sec">
  <div class="wrap">
    ${eyebrow(head.eyebrow)}<h2 class="h-l">${inline(head.title)}</h2>
    <div class="tst">${list
      .map(
        (t) => `<figure class="tst__i">
        ${t.photo ? `<img src="${attr(t.photo)}" alt="" loading="lazy">` : ''}
        <blockquote>${rich(tr(t.text, ctx.lang))}</blockquote>
        <figcaption><b>${esc(t.name)}</b>${tr(t.event, ctx.lang) ? ` · ${esc(tr(t.event, ctx.lang))}` : ''}</figcaption>
      </figure>`
      )
      .join('')}</div>
  </div>
</section>`;
}

function projectCards(ctx, list) {
  const { lang, c } = ctx;
  return `<div class="prj-grid">${list
    .map((p) => {
      const sv = c.services.find((x) => x.slug === p.category);
      return `<a class="prj" href="/${lang}/portfolio/${attr(p.slug)}" data-cat="${attr(p.category || '')}">
        <span class="prj__img">${p.cover ? (isVideo(p.cover) ? `<video src="${attr(p.cover)}" muted loop playsinline autoplay preload="metadata"></video>` : `<img src="${attr(p.cover)}" alt="" loading="lazy">`) : ''}</span>
        <span class="prj__meta">${esc(sv ? sv.title : '')}${p.location ? ' · ' + esc(p.location) : ''}</span>
        <span class="prj__t">${inline(tr(p.title, lang))}</span>
      </a>`;
    })
    .join('')}</div>`;
}

/* ---------------- pages ---------------- */
function home(ctx) {
  const { lang, c, s } = ctx;
  const h = c.home;
  const m = s.media;
  const blocks = {
    intro: () => `<section class="sec">
      <div class="wrap split">
        <div>${eyebrow(h.intro.eyebrow)}<h2 class="h-l">${inline(h.intro.title)}</h2></div>
        <div class="prose">${rich(h.intro.text)}<p><a class="link" href="/${lang}/about">${esc(h.intro.link)} →</a></p></div>
      </div>
    </section>`,
    categories: () => `<section class="sec sec--bark">
      <div class="wrap">${eyebrow(h.categories.eyebrow)}<h2 class="h-l">${inline(h.categories.title)}</h2>${serviceCards(ctx)}</div>
    </section>`,
    philosophy: () => `<section class="sec sec--sand">
      <div class="wrap split split--img">
        <div>${eyebrow(h.philosophy.eyebrow)}<h2 class="h-l">${inline(h.philosophy.title)}</h2><div class="prose">${rich(h.philosophy.text)}</div></div>
        ${m.aboutImage ? `<div class="frame">${isVideo(m.aboutImage) ? `<video src="${attr(m.aboutImage)}" muted loop playsinline autoplay></video>` : `<img src="${attr(m.aboutImage)}" alt="" loading="lazy">`}</div>` : ''}
      </div>
    </section>`,
    why: () => `<section class="sec">
      <div class="wrap">${eyebrow(h.why.eyebrow)}<h2 class="h-l">${inline(h.why.title)}</h2>${numberedList(h.why.items, 'nlist--grid')}</div>
    </section>`,
    approach: () => `<section class="sec sec--ink">
      <div class="wrap">${eyebrow(h.approach.eyebrow)}<h2 class="h-l">${inline(h.approach.title)}</h2>
        <ol class="steps">${h.approach.items.map((it, i) => `<li><span class="steps__n">${pad(i + 1)}</span><h3 class="h-s">${inline(it.title)}</h3><p>${inline(it.text)}</p></li>`).join('')}</ol>
        <p class="center">${btn(`/${lang}/approach`, h.approach.cta, 'line')}</p>
      </div>
    </section>`,
    packages: () => `<section class="sec">
      <div class="wrap">${eyebrow(h.packages.eyebrow)}<h2 class="h-l">${inline(h.packages.title)}</h2><p class="lead">${inline(h.packages.text)}</p>${packageCards(ctx, false)}
      <p class="center">${btn(`/${lang}/packages`, h.packages.cta, 'solid')}</p></div>
    </section>`,
    calculator: () =>
      s.calculator.enabled
        ? `<section class="sec sec--bark">
      <div class="wrap split">
        <div>${eyebrow(h.calculator.eyebrow)}<h2 class="h-l">${inline(h.calculator.title)}</h2></div>
        <div class="prose"><p>${inline(h.calculator.text)}</p><p>${btn(`/${lang}/estimate`, h.calculator.cta, 'solid')}</p></div>
      </div>
    </section>`
        : '',
    quote: () => `<section class="sec sec--ink quote">
      <div class="wrap"><blockquote><p>“${inline(h.quote.text)}”</p></blockquote>${h.quote.sub ? `<p class="lead center">${inline(h.quote.sub)}</p>` : ''}</div>
    </section>`,
    portfolio: () =>
      ctx.projects.length
        ? `<section class="sec">
      <div class="wrap">${eyebrow(h.portfolio.eyebrow)}<h2 class="h-l">${inline(h.portfolio.title)}</h2>${projectCards(ctx, ctx.projects.slice(0, 3))}
      <p class="center">${btn(`/${lang}/portfolio`, h.portfolio.cta, 'line')}</p></div>
    </section>`
        : '',
    testimonials: () => testimonialsBlock(ctx, h.testimonials),
    instagram: () =>
      s.contacts.instagramUrl
        ? `<section class="sec sec--sand insta">
      <div class="wrap center">${eyebrow(h.instagram.eyebrow)}<h2 class="h-l">${inline(h.instagram.title)}</h2>
      <p><a class="insta__handle" href="${attr(s.contacts.instagramUrl)}" target="_blank" rel="noopener">@${esc(s.contacts.instagramHandle)}</a></p>
      <p class="muted">${esc(h.instagram.caption)}</p></div>
    </section>`
        : '',
    cta: () => ctaBand(ctx, h.cta),
  };

  const hero = `<section class="hero">
    ${mediaBg(m.heroVideo || m.heroImage, m.heroVideo ? m.heroImage : '')}
    <div class="hero__shade"></div>
    <div class="wrap hero__in">
      ${eyebrow(h.hero.eyebrow)}
      <h1 class="h-hero">${inline(h.hero.title)}</h1>
      <p class="lead">${inline(h.hero.subtitle)}</p>
      <div class="btns">${btn(`/${lang}/enquire`, h.hero.ctaPrimary, 'solid')}${btn(`/${lang}/approach`, h.hero.ctaSecondary, 'line')}</div>
    </div>
    <span class="hero__scroll">${esc(c.ui.scroll)}</span>
  </section>`;

  const body = hero + s.homeSections.filter((x) => x.on && blocks[x.key]).map((x) => blocks[x.key]()).join('\n');
  return layout(ctx, { title: '', description: h.seo.description, body, path: '/', transparentHeader: true, titleOverride: h.seo.title });
}

function about(ctx) {
  const { c, s } = ctx;
  const a = c.about;
  const founder = s.media.founderImage;
  const body = `${pageHero(ctx, a.hero, { image: s.media.aboutImage })}
  <section class="sec"><div class="wrap split${founder ? ' split--img' : ''}">
    <div><h2 class="h-l">${inline(a.story.title)}</h2><div class="prose">${rich(a.story.text)}</div>${a.story.signature ? `<p class="sig">${esc(a.story.signature)}</p>` : ''}</div>
    ${founder ? `<div class="frame"><img src="${attr(founder)}" alt="" loading="lazy"></div>` : ''}
  </div></section>
  <section class="sec sec--ink"><div class="wrap narrow center">${eyebrow(a.mission.eyebrow)}<p class="statement">${inline(a.mission.text)}</p></div></section>
  <section class="sec sec--sand"><div class="wrap split"><div>${eyebrow(a.philosophy.eyebrow)}<h2 class="h-l">${inline(a.philosophy.title)}</h2></div><div class="prose">${rich(a.philosophy.text)}</div></div></section>
  <section class="sec"><div class="wrap">${eyebrow(a.values.eyebrow)}${numberedList(a.values.items, 'nlist--grid')}</div></section>
  <section class="sec sec--bark"><div class="wrap">${eyebrow(a.experience.eyebrow)}<h2 class="h-l">${inline(a.experience.title)}</h2>
    <div class="feel">${a.experience.items.map((it) => `<div><h3 class="h-s"><em>${esc(it.title)}</em></h3><p>${inline(it.text)}</p></div>`).join('')}</div>
    ${a.experience.text ? `<p class="lead center">${inline(a.experience.text)}</p>` : ''}</div></section>
  <section class="sec"><div class="wrap split"><div><h2 class="h-l">${inline(a.manager.title)}</h2></div><div class="prose">${rich(a.manager.text)}</div></div></section>
  <section class="sec sec--sand"><div class="wrap"><h2 class="h-l">${inline(a.principles.title)}</h2>${numberedList(a.principles.items, 'nlist--grid')}</div></section>
  <section class="sec"><div class="wrap split"><div><h2 class="h-l">${inline(a.where.title)}</h2></div><div class="prose">${rich(a.where.text)}</div></div></section>
  <section class="sec sec--ink"><div class="wrap narrow center">${eyebrow(a.vision.eyebrow)}<p class="statement">${inline(a.vision.text)}</p></div></section>
  ${ctaBand(ctx, a.cta)}`;
  return layout(ctx, { title: a.seo.title, description: a.seo.description, body, path: '/about', transparentHeader: !!s.media.aboutImage });
}

function servicesIndex(ctx) {
  const { c } = ctx;
  const p = c.servicesPage;
  const body = `${pageHero(ctx, p.hero)}
  <section class="sec sec--bark"><div class="wrap">${serviceCards(ctx)}</div></section>
  <section class="sec"><div class="wrap split"><div><h2 class="h-l">${inline(p.fullService.title)}</h2></div><div class="prose">${rich(p.fullService.text)}</div></div></section>
  <section class="sec sec--sand"><div class="wrap"><h2 class="h-l">${inline(p.extras.title)}</h2><p class="lead">${inline(p.extras.text)}</p>
    <div class="cols3">${p.extras.items.map((it) => `<div class="cell"><h3 class="h-s">${inline(it.title)}</h3><p>${inline(it.text)}</p></div>`).join('')}</div></div></section>
  ${ctaBand(ctx, p.cta)}`;
  return layout(ctx, { title: p.seo.title, description: p.seo.description, body, path: '/services' });
}

function service(ctx, sv) {
  const { lang, c, s } = ctx;
  const img = s.media.serviceImages[sv.slug];
  const others = c.services.filter((x) => x.slug !== sv.slug);
  const body = `${pageHero(ctx, sv.hero, { image: img, cta: `<div class="btns">${btn(`/${lang}/enquire?type=${encodeURIComponent(sv.slug)}`, sv.hero.cta, 'solid')}</div>` })}
  <section class="sec"><div class="wrap narrow prose prose--lg">${rich(sv.intro)}</div></section>
  ${sv.items && sv.items.length ? `<section class="sec sec--bark"><div class="wrap"><h2 class="h-l">${inline(sv.listTitle)}</h2>${numberedList(sv.items, 'nlist--grid')}</div></section>` : ''}
  ${sv.extraList && sv.extraList.length ? `<section class="sec sec--sand"><div class="wrap split"><div><h2 class="h-l">${inline(sv.extraTitle)}</h2></div><ul class="ticks ticks--lg">${sv.extraList.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></div></section>` : ''}
  ${sv.noteTitle || sv.noteText ? `<section class="sec"><div class="wrap split"><div><h2 class="h-l">${inline(sv.noteTitle)}</h2></div><div class="prose">${rich(sv.noteText)}</div></div></section>` : ''}
  ${ctaBand(ctx, sv.cta, `/${lang}/enquire?type=${encodeURIComponent(sv.slug)}`)}
  <section class="sec sec--ink"><div class="wrap"><p class="eyebrow">${esc(c.common.allServices)}</p><div class="more-svc">${others.map((o) => `<a href="/${lang}/services/${attr(o.slug)}">${esc(o.title)} →</a>`).join('')}</div></div></section>`;
  return layout(ctx, { title: sv.seo.title, description: sv.seo.description, body, path: '/services/' + sv.slug, transparentHeader: !!img, ogImage: img && !isVideo(img) ? img : '' });
}

function packages(ctx) {
  const { lang, c, s } = ctx;
  const p = c.packagesPage;
  const rows = p.compare.rows || [];
  const body = `${pageHero(ctx, p.hero)}
  <section class="sec"><div class="wrap">${packageCards(ctx, true)}</div></section>
  <section class="sec sec--bark"><div class="wrap"><h2 class="h-l">${inline(p.compare.title)}</h2><p class="lead">${inline(p.compare.text)}</p>
    <div class="table-wrap"><table class="cmp"><thead><tr>${(p.compare.headers || []).map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((cell, i) => (i === 0 ? `<th scope="row">${esc(cell)}</th>` : `<td>${esc(cell)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div></div></section>
  <section class="sec sec--sand"><div class="wrap split"><div><h2 class="h-l">${inline(p.pricing.title)}</h2><p class="lead">${inline(p.pricing.text)}</p></div>
    <div><ul class="ticks">${p.pricing.factors.map((x) => `<li>${inline(x)}</li>`).join('')}</ul><div class="prose">${rich(p.pricing.after)}</div></div></div></section>
  <section class="sec"><div class="wrap narrow center"><h2 class="h-l">${inline(p.help.title)}</h2><p class="lead">${inline(p.help.text)}</p>
    <div class="btns btns--center">${btn(`/${lang}/enquire`, p.help.button, 'solid')}${s.calculator.enabled ? btn(`/${lang}/estimate`, p.help.calc, 'line') : ''}</div></div></section>`;
  return layout(ctx, { title: p.seo.title, description: p.seo.description, body, path: '/packages' });
}

function approach(ctx) {
  const { c } = ctx;
  const p = c.approachPage;
  const body = `${pageHero(ctx, p.hero)}
  <section class="sec"><div class="wrap"><ol class="timeline">${p.steps
    .map((st, i) => `<li><span class="timeline__n">${pad(i + 1)}</span><div><h3 class="h-m">${inline(st.title)}</h3><p>${inline(st.text)}</p></div></li>`)
    .join('')}</ol></div></section>
  <section class="sec sec--sand"><div class="wrap split"><div><h2 class="h-l">${inline(p.comms.title)}</h2></div><ul class="ticks ticks--lg">${p.comms.items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></div></section>
  ${ctaBand(ctx, p.cta)}`;
  return layout(ctx, { title: p.seo.title, description: p.seo.description, body, path: '/approach' });
}

function portfolio(ctx) {
  const { c } = ctx;
  const p = c.portfolioPage;
  const cats = [...new Set(ctx.projects.map((x) => x.category).filter(Boolean))];
  const body = `${pageHero(ctx, p.hero)}
  <section class="sec"><div class="wrap">
    ${ctx.projects.length ? `${cats.length > 1 ? `<div class="filters" role="group"><button class="on" data-filter="">${esc(p.all)}</button>${cats.map((k) => `<button data-filter="${attr(k)}">${esc((c.services.find((x) => x.slug === k) || {}).title || k)}</button>`).join('')}</div>` : ''}${projectCards(ctx, ctx.projects)}` : `<p class="lead center">${inline(p.empty)}</p>`}
  </div></section>
  ${ctaBand(ctx, p.cta)}`;
  return layout(ctx, { title: p.seo.title, description: p.seo.description, body, path: '/portfolio' });
}

function project(ctx, pr) {
  const { lang, c } = ctx;
  const p = c.portfolioPage;
  const sv = c.services.find((x) => x.slug === pr.category);
  const gallery = (pr.images || []).filter(Boolean);
  const block = (label, text) => (tr(text, lang) ? `<div><p class="eyebrow">${esc(label)}</p><div class="prose">${rich(tr(text, lang))}</div></div>` : '');
  const body = `${pageHero(ctx, { eyebrow: [sv && sv.title, pr.location, pr.guests ? `${p.guestsLabel}: ${pr.guests}` : ''].filter(Boolean).join(' · '), title: tr(pr.title, lang), subtitle: tr(pr.summary, lang) }, { image: pr.cover })}
  <section class="sec"><div class="wrap cols3">${block(p.briefLabel, pr.brief)}${block(p.conceptLabel, pr.concept)}${block(p.detailsLabel, pr.details)}</div></section>
  ${pr.video ? `<section class="sec sec--ink"><div class="wrap"><video class="pvideo" src="${attr(pr.video)}" controls playsinline preload="metadata"${pr.cover && !isVideo(pr.cover) ? ` poster="${attr(pr.cover)}"` : ''}></video></div></section>` : ''}
  ${gallery.length ? `<section class="sec"><div class="wrap gallery">${gallery.map((g) => (isVideo(g) ? `<video src="${attr(g)}" controls playsinline preload="metadata"></video>` : `<a href="${attr(g)}" class="gallery__i" data-lightbox><img src="${attr(g)}" alt="" loading="lazy"></a>`)).join('')}</div></section>` : ''}
  <section class="sec sec--bark"><div class="wrap center"><a class="link" href="/${lang}/portfolio">← ${esc(p.backLabel)}</a></div></section>
  ${ctaBand(ctx, p.cta)}`;
  return layout(ctx, { title: plain(tr(pr.title, lang)), description: plain(tr(pr.summary, lang)), body, path: '/portfolio/' + pr.slug, transparentHeader: !!pr.cover, ogImage: pr.cover && !isVideo(pr.cover) ? pr.cover : '' });
}

function faq(ctx) {
  const { lang, c } = ctx;
  const p = c.faqPage;
  const body = `${pageHero(ctx, p.hero)}
  <section class="sec"><div class="wrap narrow faq">${p.items.map((it) => `<details><summary>${esc(it.q)}</summary><div class="prose">${rich(it.a)}</div></details>`).join('')}
  <p class="center faq__cta">${esc(p.cta.text)}</p><p class="center">${btn(`/${lang}/enquire`, p.cta.button, 'solid')}</p></div></section>`;
  return layout(ctx, { title: p.seo.title, description: p.seo.description, body, path: '/faq' });
}

function calculatorData(ctx) {
  const { lang, c, s } = ctx;
  const k = s.calculator;
  return {
    currency: k.currency,
    spread: Number(k.spread) || 0,
    locale: { en: 'en-GB', pl: 'pl-PL', uk: 'uk-UA', ru: 'ru-RU' }[lang],
    types: c.services.map((sv) => ({ key: sv.slug, label: sv.title, ...(k.types[sv.slug] || { base: 0, perGuest: 0 }) })),
    packages: c.packagesPage.packages.map((p) => ({ key: p.key, label: p.name, mult: Number(k.packages[p.key]) || 1 })),
    extras: (k.extras || []).map((e) => ({ key: e.key, label: tr(e.label, lang), price: Number(e.price) || 0, perGuest: !!e.perGuest })),
  };
}

function calculator(ctx, q) {
  const { lang, c, s } = ctx;
  const p = c.calculatorPage;
  const d = calculatorData(ctx);
  const k = s.calculator;
  const g = Math.min(k.maxGuests, Math.max(k.minGuests, Number(q.guests) || k.defaultGuests));
  const body = `${pageHero(ctx, p.hero)}
  <section class="sec"><div class="wrap calc" id="calc" data-lang="${lang}">
    <form class="calc__form" id="calcForm" onsubmit="return false">
      <fieldset><legend class="eyebrow">${esc(p.typeLabel)}</legend><div class="chips">${d.types.map((t, i) => `<label class="chip"><input type="radio" name="type" value="${attr(t.key)}" ${(q.type ? q.type === t.key : i === 0) ? 'checked' : ''}><span>${esc(t.label)}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend class="eyebrow">${esc(p.guestsLabel)}: <output id="gOut">${g}</output></legend>
        <input type="range" id="guests" name="guests" min="${k.minGuests}" max="${k.maxGuests}" step="5" value="${g}" aria-label="${attr(p.guestsLabel)}"></fieldset>
      <fieldset><legend class="eyebrow">${esc(p.packageLabel)}</legend><div class="chips">${d.packages.map((pk, i) => `<label class="chip"><input type="radio" name="package" value="${attr(pk.key)}" ${i === 0 ? 'checked' : ''}><span>${esc(pk.label)}</span></label>`).join('')}</div></fieldset>
      ${d.extras.length ? `<fieldset><legend class="eyebrow">${esc(p.extrasLabel)}</legend><div class="chips">${d.extras.map((e) => `<label class="chip"><input type="checkbox" name="extras" value="${attr(e.key)}"><span>${esc(e.label)}</span></label>`).join('')}</div></fieldset>` : ''}
    </form>
    <aside class="calc__res" aria-live="polite">
      <p class="eyebrow">${esc(p.resultLabel)}</p>
      <p class="calc__sum"><span class="calc__lbl">${esc(p.fromLabel)}</span> <span id="low">—</span><br><span class="calc__lbl">${esc(p.toLabel)}</span> <span id="high">—</span></p>
      <p class="calc__pg" id="pg"></p>
      <p class="small">${inline(p.includes)}</p>
      <a class="btn btn--solid" id="calcSend" href="/${lang}/enquire">${esc(p.send)}</a>
      <p class="small muted">${inline(p.disclaimer)}</p>
      <p class="small">${esc(p.contact)} ${contactLines(ctx)}</p>
    </aside>
  </div></section>
  <script type="application/json" id="calcData">${JSON.stringify({ ...d, perGuest: p.perGuest }).replace(/</g, '\\u003c')}</script>`;
  return layout(ctx, { title: p.seo.title, description: p.seo.description, body, path: '/estimate' });
}

function enquire(ctx, q) {
  const { lang, c, s } = ctx;
  const p = c.contactPage;
  const f = p.form;
  const k = s.contacts;
  const sel = (name, label, opts, val, req) =>
    `<label class="fld"><span>${esc(label)}${req ? ' *' : ''}</span><select name="${name}" ${req ? 'required' : ''}><option value="">${esc(f.select)}</option>${opts
      .map((o) => (typeof o === 'string' ? { v: o, l: o } : o))
      .map((o) => `<option value="${attr(o.v)}"${o.v === val ? ' selected' : ''}>${esc(o.l)}</option>`)
      .join('')}</select></label>`;
  const inp = (name, label, type = 'text', req = false, extra = '') =>
    `<label class="fld"><span>${esc(label)}${req ? ' *' : ''}</span><input name="${name}" type="${type}" ${req ? 'required' : ''} ${extra}></label>`;
  const types = c.services.map((sv) => ({ v: sv.slug, l: sv.title })).concat([{ v: 'other', l: f.eventTypeOther }]);
  const pk = c.packagesPage.packages.map((x) => ({ v: x.key, l: x.name })).concat([{ v: 'not-sure', l: f.packageNotSure }]);
  const estimate = q.estimate ? String(q.estimate).slice(0, 200) : '';
  const guestsPrefill = q.guests ? String(q.guests).slice(0, 10) : '';
  const body = `${pageHero(ctx, p.hero)}
  <section class="sec"><div class="wrap enq">
    <form class="form" id="enqForm" method="post" action="/api/enquiry" novalidate>
      <input type="hidden" name="lang" value="${lang}">
      ${estimate ? `<input type="hidden" name="estimate" value="${attr(estimate)}"><div class="estimate"><span class="eyebrow">${esc(f.estimate)}</span><b>${esc(estimate)}</b>${guestsPrefill ? ` · ${esc(guestsPrefill)}` : ''}</div>` : ''}
      ${guestsPrefill ? `<input type="hidden" name="guestsExact" value="${attr(guestsPrefill)}">` : ''}
      <div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <fieldset><legend class="eyebrow">${esc(f.aboutYou)}</legend>
        <div class="row2">${inp('name', f.name, 'text', true, 'autocomplete="name"')}${inp('email', f.email, 'email', true, 'autocomplete="email"')}</div>
        <div class="row2">${inp('phone', f.phone, 'tel', true, 'autocomplete="tel"')}${inp('company', f.company, 'text', false, 'autocomplete="organization"')}</div>
        ${sel('contactPref', f.contactPref, f.contactPrefOptions, '', false)}
      </fieldset>
      <fieldset><legend class="eyebrow">${esc(f.yourEvent)}</legend>
        <div class="row2">${sel('eventType', f.eventType, types, q.type || '', true)}${inp('date', f.date, 'text', true)}</div>
        <div class="row2">${sel('guests', f.guests, f.guestsOptions, '', false)}${sel('location', f.location, f.locationOptions, '', false)}</div>
        <div class="row2">${sel('venue', f.venue, f.venueOptions, '', false)}${sel('package', f.package, pk, q.package || '', false)}</div>
        ${sel('budget', f.budget, f.budgetOptions, '', false)}
        <label class="fld"><span>${esc(f.vision)} *</span><textarea name="vision" rows="5" required placeholder="${attr(f.visionPlaceholder)}"></textarea></label>
        ${sel('source', f.source, f.sourceOptions, '', false)}
      </fieldset>
      <label class="consent"><input type="checkbox" name="consent" value="yes" required><span>${esc(f.consent)} <a href="/${lang}/privacy-policy" target="_blank">↗</a></span></label>
      <p class="form__err" id="formErr" hidden></p>
      <button class="btn btn--solid" type="submit" data-sending="${attr(c.ui.sending)}">${esc(f.submit)}</button>
      <p class="small muted">${esc(f.note)}</p>
    </form>
    <aside class="enq__side">
      <h2 class="h-m">${inline(p.direct.title)}</h2>
      <dl class="dl">
        ${k.phone ? `<dt>${esc(p.direct.phone)}</dt><dd><a href="tel:${attr(k.phone.replace(/[^\d+]/g, ''))}">${esc(k.phone)}</a>${k.whatsapp ? ` · <a href="https://wa.me/${attr(String(k.whatsapp).replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}${k.telegram ? ` · <a href="https://t.me/${attr(k.telegram.replace(/^@/, ''))}" target="_blank" rel="noopener">Telegram</a>` : ''}</dd>` : ''}
        ${k.email ? `<dt>${esc(p.direct.email)}</dt><dd><a href="mailto:${attr(k.email)}">${esc(k.email)}</a></dd>` : ''}
        ${k.instagramUrl ? `<dt>${esc(p.direct.instagram)}</dt><dd><a href="${attr(k.instagramUrl)}" target="_blank" rel="noopener">@${esc(k.instagramHandle)}</a></dd>` : ''}
        <dt>${esc(p.direct.studio)}</dt><dd>${esc(p.direct.studioValue)}</dd>
        <dt>${esc(p.direct.hours)}</dt><dd>${esc(p.direct.hoursValue)}</dd>
      </dl>
    </aside>
  </div></section>
  <script type="application/json" id="formMsg">${JSON.stringify({ err: c.ui.formError, send: c.ui.formSendError, thanks: `/${lang}/enquire/thank-you` }).replace(/</g, '\\u003c')}</script>`;
  return layout(ctx, { title: p.seo.title, description: p.seo.description, body, path: '/enquire' });
}

function thanks(ctx) {
  const { lang, c, s } = ctx;
  const t = c.contactPage.thanks;
  const body = `<section class="sec thanks"><div class="wrap narrow center">
    <img class="thanks__logo" src="${attr(s.theme.logo)}" alt="">
    <h1 class="h-xl">${inline(t.title)}</h1><p class="lead">${inline(t.text)}</p><p>${inline(t.text2)}</p>
    <div class="btns btns--center">${s.contacts.instagramUrl ? btn(s.contacts.instagramUrl, t.instagram, 'solid') : ''}${btn(`/${lang}/`, t.back, 'line')}</div>
  </div></section>`;
  return layout(ctx, { title: t.seoTitle, body, path: '/enquire/thank-you', noindex: true });
}

function legal(ctx, key, path) {
  const d = ctx.c.legal[key];
  const body = `${pageHero(ctx, { title: d.title })}<section class="sec"><div class="wrap narrow prose legal">${rich(d.body)}</div></section>`;
  return layout(ctx, { title: plain(d.title), body, path });
}

function notFound(ctx) {
  const { lang, c } = ctx;
  const body = `<section class="sec thanks"><div class="wrap narrow center"><p class="eyebrow">404</p><h1 class="h-xl">${inline(c.ui.notFoundTitle)}</h1><p class="lead">${inline(c.ui.notFoundText)}</p>${btn(`/${lang}/`, c.ui.backHome, 'solid')}</div></section>`;
  return layout(ctx, { title: '404', body, path: '/', noindex: true });
}

module.exports = { home, about, servicesIndex, service, packages, approach, portfolio, project, faq, calculator, enquire, thanks, legal, notFound, esc, tr, plain };
