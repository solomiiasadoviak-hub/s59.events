(function () {
  'use strict';
  var LANG_NAMES = { en: 'EN', pl: 'PL', uk: 'UA', ru: 'RU' };
  var LANG_FULL = { en: 'English', pl: 'Polski', uk: 'Українська', ru: 'Русский' };
  var S = { settings: null, langs: ['en', 'pl', 'uk', 'ru'], slugs: [], newCount: 0, dirty: false, route: '', persistent: true, dataDir: '' };
  var app = document.getElementById('app');

  /* ---------------- tiny DOM helper ---------------- */
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) return kid.forEach(function (k) { add(el, k); });
    el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  function api(method, url, body) {
    var opt = { method: method, headers: { 'x-s59': '1' }, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch('/admin/api' + url, opt).then(function (r) {
      if (r.status === 401) { showLogin(); throw new Error('auth'); }
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
      });
    });
  }
  var toastT;
  function toast(msg, bad) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function setDirty(v) {
    S.dirty = v;
    var d = document.getElementById('dirty');
    if (d) d.hidden = !v;
  }
  window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------------- form controls ---------------- */
  function field(label, control, help) {
    return h('div', { class: 'f' }, h('label', {}, label), control, help ? h('div', { class: 'help', html: help }) : null);
  }
  function text(obj, key, opts) {
    opts = opts || {};
    var v = obj[key] == null ? '' : obj[key];
    var long = opts.area || String(v).length > 90 || String(v).indexOf('\n') > -1;
    var el = long
      ? h('textarea', { rows: Math.min(14, Math.max(3, Math.ceil(String(v).length / 90) + (String(v).match(/\n/g) || []).length)), oninput: function () { obj[key] = el.value; setDirty(true); } })
      : h('input', { type: opts.type || 'text', placeholder: opts.placeholder || '', oninput: function () { obj[key] = opts.type === 'number' ? Number(el.value) : el.value; setDirty(true); if (opts.onchange) opts.onchange(); } });
    el.value = v;
    return el;
  }
  function tf(label, obj, key, opts) { return field(label, text(obj, key, opts), opts && opts.help); }
  function toggle(label, obj, key, onchange) {
    var i = h('input', { type: 'checkbox', checked: !!obj[key], onchange: function () { obj[key] = i.checked; setDirty(true); if (onchange) onchange(); } });
    return h('label', { class: 'switch' }, i, label);
  }
  function select(obj, key, options, onchange) {
    var s = h('select', { onchange: function () { obj[key] = s.value; setDirty(true); if (onchange) onchange(); } },
      options.map(function (o) { return h('option', { value: o[0] }, o[1]); }));
    s.value = obj[key] == null ? '' : obj[key];
    return s;
  }
  function colorField(label, obj, key) {
    var t = h('input', { type: 'text', class: 'inp', value: obj[key], oninput: function () { obj[key] = t.value; c.value = t.value; setDirty(true); } });
    var c = h('input', { type: 'color', value: obj[key], oninput: function () { obj[key] = c.value.toUpperCase(); t.value = obj[key]; setDirty(true); } });
    return field(label, h('div', { class: 'color' }, c, t));
  }
  function isVideo(u) { return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u || ''); }
  function preview(url) {
    var pv = h('div', { class: 'pv' });
    if (url && isVideo(url)) pv.appendChild(h('video', { src: url, muted: true }));
    else if (url) pv.style.backgroundImage = 'url("' + url.replace(/"/g, '') + '")';
    return pv;
  }
  function mediaField(label, obj, key, kind, help) {
    var wrap = h('div', { class: 'picker' });
    function draw() {
      wrap.innerHTML = '';
      var inp = h('input', { type: 'text', class: 'inp', value: obj[key] || '', placeholder: 'URL або оберіть з медіа', oninput: function () { obj[key] = inp.value.trim(); setDirty(true); } });
      add(wrap, [preview(obj[key]), h('div', { class: 'grow', style: 'flex:1;min-width:0' }, inp),
        h('button', { class: 'btn sm', type: 'button', onclick: function () { pickMedia(kind).then(function (u) { if (u) { obj[key] = u; setDirty(true); draw(); } }); } }, 'Обрати'),
        obj[key] ? h('button', { class: 'btn sm ico', type: 'button', title: 'Прибрати', onclick: function () { obj[key] = ''; setDirty(true); draw(); } }, '×') : null]);
    }
    draw();
    return field(label, wrap, help);
  }
  function langTabs(current, onpick) {
    return h('div', { class: 'tabs' }, S.langs.map(function (l) {
      return h('button', { type: 'button', class: l === current ? 'on' : '', onclick: function () { onpick(l); } }, LANG_FULL[l]);
    }));
  }
  function savebar(onSave, extra) {
    var b = h('button', { class: 'btn pri', onclick: function () {
      b.disabled = true;
      Promise.resolve(onSave()).then(function () { setDirty(false); toast('Збережено'); }).catch(function (e) { if (e.message !== 'auth') toast('Помилка: ' + e.message, true); }).then(function () { b.disabled = false; });
    } }, 'Зберегти зміни');
    return h('div', { class: 'savebar' }, b, h('span', { id: 'dirty', class: 'dirty', hidden: !S.dirty }, '● Є незбережені зміни'), extra || null);
  }

  /* ---------------- login ---------------- */
  function showLogin() {
    var err = h('p', { class: 'err', hidden: true });
    var pw = h('input', { type: 'password', placeholder: 'Пароль', autocomplete: 'current-password', required: true });
    app.innerHTML = '';
    add(app, h('div', { class: 'login' }, h('form', { onsubmit: function (e) {
      e.preventDefault();
      fetch('/admin/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw.value }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Помилка'); }); })
        .then(boot).catch(function (e2) { err.textContent = e2.message; err.hidden = false; });
    } }, h('img', { src: '/img/logo.png', alt: 'S59' }), pw, err, h('button', { type: 'submit' }, 'Увійти'))));
    pw.focus();
  }

  /* ---------------- shell ---------------- */
  var ROUTES = [
    ['enquiries', 'Заявки'],
    ['content', 'Тексти сайту'],
    ['portfolio', 'Портфоліо'],
    ['testimonials', 'Відгуки'],
    ['media', 'Фото та відео'],
    ['design', 'Дизайн'],
    ['calculator', 'Калькулятор'],
    ['contacts', 'Контакти'],
    ['integrations', 'CRM та сповіщення'],
    ['languages', 'Мови та SEO'],
    ['security', 'Безпека та копії'],
  ];
  var main, side;
  function boot() {
    return api('GET', '/state').then(function (st) {
      S.settings = st.settings; S.langs = st.langs; S.slugs = st.serviceSlugs; S.newCount = st.newEnquiries;
      S.persistent = st.persistent; S.dataDir = st.dataDir;
      app.innerHTML = '';
      side = h('aside', { class: 'side' });
      main = h('main', { class: 'main' });
      add(app, h('div', { class: 'topbar' }, h('button', { onclick: function () { side.classList.toggle('open'); } }, '☰'), h('img', { src: S.settings.theme.logo, alt: '' }), h('span', {}, 'Адмін-панель')));
      add(app, h('div', { class: 'shell' }, side, main));
      drawSide();
      go();
    });
  }
  function drawSide() {
    side.innerHTML = '';
    add(side, h('div', { class: 'side__logo' }, h('img', { src: S.settings.theme.logo, alt: '' }), h('span', {}, 'Адмін-панель')));
    ROUTES.forEach(function (r) {
      add(side, h('a', { class: 'nav' + (S.route === r[0] ? ' on' : ''), href: '#' + r[0] }, r[1], r[0] === 'enquiries' && S.newCount ? h('span', { class: 'badge' }, S.newCount) : null));
    });
    add(side, h('div', { class: 'side__bottom' },
      h('a', { href: '/', target: '_blank' }, '↗ Відкрити сайт'),
      h('button', { onclick: function () { api('POST', '/logout').then(showLogin); } }, 'Вийти')));
  }
  function go() {
    var r = (location.hash || '#enquiries').slice(1);
    if (!ROUTES.some(function (x) { return x[0] === r; })) r = 'enquiries';
    if (S.dirty && S.route && S.route !== r && !confirm('Є незбережені зміни. Перейти без збереження?')) { location.hash = '#' + S.route; return; }
    setDirty(false);
    S.route = r;
    drawSide();
    side.classList.remove('open');
    main.innerHTML = '<p class="muted">Завантаження…</p>';
    window.scrollTo(0, 0);
    VIEWS[r]();
  }
  window.addEventListener('hashchange', function () { if (S.settings) go(); });
  function head(title, desc, tools) {
    return h('div', { class: 'head' }, h('div', {}, h('h1', {}, title), desc ? h('p', { html: desc }) : null), tools ? h('div', { class: 'tools' }, tools) : null);
  }
  function saveSettings() { return api('PUT', '/settings', S.settings); }

  /* ---------------- media picker ---------------- */
  function pickMedia(kind, multi) {
    return new Promise(function (resolve) {
      var chosen = [];
      var grid = h('div', { class: 'media-grid' });
      var bg = h('div', { class: 'modal-bg', onclick: function (e) { if (e.target === bg) close(null); } });
      function close(v) { bg.remove(); resolve(v); }
      function load() {
        api('GET', '/media').then(function (list) {
          grid.innerHTML = '';
          list = list.filter(function (m) { return !kind || kind === 'any' || m.mime.indexOf(kind) === 0; });
          if (!list.length) add(grid, h('p', { class: 'muted' }, 'Тут ще немає файлів. Завантажте їх кнопкою вище.'));
          list.forEach(function (m) {
            var card = h('div', { class: 'mi pick', onclick: function () {
              if (!multi) return close(m.url);
              var i = chosen.indexOf(m.url);
              if (i > -1) { chosen.splice(i, 1); card.style.outline = ''; } else { chosen.push(m.url); card.style.outline = '3px solid #2D241D'; }
            } }, h('div', { class: 'th' }, thumb(m)), h('div', { class: 'meta' }, m.original));
            add(grid, card);
          });
        });
      }
      var up = uploader(load, kind === 'video' ? 'video/*' : kind === 'image' ? 'image/*' : 'image/*,video/*');
      add(bg, h('div', { class: 'modal' },
        h('div', { class: 'modal-h' }, h('h3', {}, multi ? 'Оберіть файли' : 'Оберіть файл'),
          h('div', { class: 'tools' }, multi ? h('button', { class: 'btn pri', onclick: function () { close(chosen); } }, 'Додати обрані') : null, h('button', { class: 'btn', onclick: function () { close(null); } }, 'Закрити'))),
        up, grid));
      document.body.appendChild(bg);
      load();
    });
  }
  function thumb(m) {
    if (m.mime.indexOf('image') === 0) return h('img', { src: m.url, alt: '', loading: 'lazy' });
    if (m.mime.indexOf('video') === 0) return h('video', { src: m.url, muted: true, preload: 'metadata' });
    return h('span', { class: 'muted' }, (m.original.split('.').pop() || 'file').toUpperCase());
  }
  function uploader(onDone, accept) {
    var input = h('input', { type: 'file', multiple: true, accept: accept || '', hidden: true, onchange: function () { send(input.files); } });
    var label = h('span', {}, 'Перетягніть сюди фото або відео, або натисніть, щоб обрати файли (до 300 МБ кожен)');
    var drop = h('div', { class: 'drop', onclick: function () { input.click(); },
      ondragover: function (e) { e.preventDefault(); drop.classList.add('over'); },
      ondragleave: function () { drop.classList.remove('over'); },
      ondrop: function (e) { e.preventDefault(); drop.classList.remove('over'); send(e.dataTransfer.files); } }, label, input);
    function send(files) {
      if (!files || !files.length) return;
      var fd = new FormData();
      Array.prototype.forEach.call(files, function (f) { fd.append('files', f); });
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/admin/api/media');
      xhr.setRequestHeader('x-s59', '1');
      xhr.upload.onprogress = function (e) { if (e.lengthComputable) label.textContent = 'Завантаження… ' + Math.round(e.loaded / e.total * 100) + '%'; };
      xhr.onload = function () {
        label.textContent = 'Перетягніть сюди фото або відео, або натисніть, щоб обрати файли (до 300 МБ кожен)';
        if (xhr.status === 200) {
          var j = JSON.parse(xhr.responseText);
          toast(j.added.length ? 'Завантажено: ' + j.added.length : 'Цей тип файлу не підтримується', !j.added.length);
          onDone(j.added);
        } else toast('Не вдалося завантажити (' + xhr.status + ')', true);
        input.value = '';
      };
      xhr.onerror = function () { toast('Помилка мережі під час завантаження', true); };
      xhr.send(fd);
    }
    return drop;
  }

  /* ================= VIEWS ================= */
  var VIEWS = {};

  /* ---------- enquiries ---------- */
  var STATUSES = [['new', 'Нова'], ['progress', 'В роботі'], ['proposal', 'Пропозицію надіслано'], ['won', 'Підписано'], ['lost', 'Відмова'], ['archived', 'Архів']];
  var STATUS_NAME = {}; STATUSES.forEach(function (s) { STATUS_NAME[s[0]] = s[1]; });
  var FIELD_NAMES = [['name', "Ім'я"], ['email', 'Email'], ['phone', 'Телефон'], ['company', 'Компанія'], ['contactPref', 'Зручний звʼязок'], ['eventTypeLabel', 'Тип події'], ['date', 'Дата / сезон'], ['guests', 'Кількість гостей'], ['guestsExact', 'Гостей (з калькулятора)'], ['location', 'Локація'], ['venue', 'Площадка'], ['packageLabel', 'Пакет'], ['budget', 'Бюджет'], ['estimate', 'Розрахунок з калькулятора'], ['source', 'Звідки дізналися'], ['vision', 'Опис події']];
  VIEWS.enquiries = function () {
    var filter = { status: '', q: '' };
    var listEl = h('div');
    var all = [];
    function fmt(d) { var x = new Date(d); return x.toLocaleDateString('uk-UA') + ' ' + x.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }); }
    function draw() {
      listEl.innerHTML = '';
      var rows = all.filter(function (e) {
        if (filter.status && e.status !== filter.status) return false;
        if (filter.q) { var s = JSON.stringify(e.data).toLowerCase() + ' ' + e.notes.toLowerCase(); if (s.indexOf(filter.q.toLowerCase()) < 0) return false; }
        return true;
      });
      if (!all.length) return add(listEl, h('div', { class: 'empty' }, 'Заявок ще немає. Коли клієнт заповнить форму на сайті, вона з’явиться тут.'));
      if (!rows.length) return add(listEl, h('div', { class: 'empty' }, 'Нічого не знайдено.'));
      add(listEl, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, ['№', 'Отримано', 'Клієнт', 'Подія', 'Дата', 'Гості', 'Бюджет', 'Статус'].map(function (x) { return h('th', {}, x); }))),
        h('tbody', {}, rows.map(function (e) {
          return h('tr', { class: 'click', onclick: function () { open(e); } },
            h('td', {}, '#' + e.id), h('td', {}, fmt(e.created_at)),
            h('td', {}, h('b', {}, e.data.name || '—'), h('br'), h('span', { class: 'muted' }, e.data.phone || '')),
            h('td', {}, e.data.eventTypeLabel || ''), h('td', {}, e.data.date || ''), h('td', {}, e.data.guestsExact || e.data.guests || ''),
            h('td', {}, e.data.estimate || e.data.budget || ''), h('td', {}, h('span', { class: 'pill ' + e.status }, STATUS_NAME[e.status] || e.status)));
        })))));
    }
    function open(e) {
      var bg = h('div', { class: 'drawer-bg', onclick: close });
      var st = { status: e.status, notes: e.notes };
      var phone = (e.data.phone || '').replace(/[^\d+]/g, '');
      var dr = h('div', { class: 'drawer' },
        h('div', { class: 'modal-h' }, h('div', {}, h('h2', {}, e.data.name || 'Заявка'), h('span', { class: 'muted' }, '#' + e.id + ' · ' + fmt(e.created_at) + ' · мова: ' + (LANG_NAMES[e.lang] || e.lang))), h('button', { class: 'btn', onclick: close }, 'Закрити')),
        h('div', { class: 'tools' },
          e.data.email ? h('a', { class: 'btn', href: 'mailto:' + e.data.email }, '✉ Написати') : null,
          phone ? h('a', { class: 'btn', href: 'tel:' + phone }, '☎ Подзвонити') : null,
          phone ? h('a', { class: 'btn', href: 'https://wa.me/' + phone.replace(/\D/g, ''), target: '_blank' }, 'WhatsApp') : null),
        h('dl', { class: 'kv' }, FIELD_NAMES.filter(function (f) { return e.data[f[0]]; }).map(function (f) { return [h('dt', {}, f[1]), h('dd', {}, e.data[f[0]])]; })),
        h('div', { class: 'card' },
          field('Статус', select(st, 'status', STATUSES)),
          h('div', { class: 'mt' }, field('Нотатки менеджера (бачите тільки ви)', text(st, 'notes', { area: true }))),
          h('div', { class: 'tools mt' },
            h('button', { class: 'btn pri', onclick: function () { api('PATCH', '/enquiries/' + e.id, st).then(function () { e.status = st.status; e.notes = st.notes; toast('Збережено'); setDirty(false); refreshCount(); draw(); close(); }); } }, 'Зберегти'),
            h('button', { class: 'btn', onclick: function () { api('POST', '/enquiries/' + e.id + '/resend').then(function (r) { toast(r.log); }); } }, 'Надіслати в CRM / Telegram ще раз'),
            h('button', { class: 'btn danger', onclick: function () { if (confirm('Видалити заявку #' + e.id + ' назавжди?')) api('DELETE', '/enquiries/' + e.id).then(function () { all = all.filter(function (x) { return x.id !== e.id; }); draw(); close(); refreshCount(); }); } }, 'Видалити'))),
        e.notify ? h('p', { class: 'muted' }, 'Сповіщення: ' + e.notify) : null,
        e.data.page ? h('p', { class: 'muted' }, 'Сторінка: ' + e.data.page) : null);
      function close() { setDirty(false); bg.remove(); dr.remove(); }
      document.body.appendChild(bg); document.body.appendChild(dr);
    }
    var search = h('input', { class: 'inp', type: 'text', placeholder: 'Пошук: імʼя, телефон, email…', style: 'width:240px', oninput: function () { filter.q = search.value; draw(); } });
    main.innerHTML = '';
    add(main, [head('Заявки', 'Усі заявки з форми на сайті. Нові також надходять у Telegram, на пошту або в CRM, якщо це налаштовано в розділі «CRM та сповіщення».',
      [search, select(filter, 'status', [['', 'Усі статуси']].concat(STATUSES), draw), h('a', { class: 'btn', href: '/admin/api/enquiries.csv' }, '⇩ Excel / CSV')]), listEl]);
    api('GET', '/enquiries').then(function (l) { all = l; draw(); });
  };
  function refreshCount() { api('GET', '/state').then(function (st) { S.newCount = st.newEnquiries; drawSide(); }); }

  /* ---------- content editor ---------- */
  var PAGES = [
    ['home', 'Головна', '/'], ['about', 'Про нас', '/about'], ['servicesPage', 'Послуги — загальна', '/services'], ['services', 'Послуги — сторінки', '/services'],
    ['packagesPage', 'Пакети', '/packages'], ['approachPage', 'Як ми працюємо', '/approach'], ['calculatorPage', 'Калькулятор', '/estimate'],
    ['contactPage', 'Форма заявки', '/enquire'], ['faqPage', 'Питання (FAQ)', '/faq'], ['portfolioPage', 'Портфоліо — тексти', '/portfolio'],
    ['nav', 'Меню', '/'], ['common', 'Кнопки', '/'], ['footer', 'Футер', '/'], ['legal', 'Юридичні сторінки', '/privacy-policy'], ['ui', 'Службові тексти', '/'], ['meta', 'Загальне', '/'],
  ];
  var LBL = {
    seo: 'SEO — як сторінка виглядає в Google', title: 'Заголовок', description: 'Опис', eyebrow: 'Надзаголовок (дрібний текст зверху)', subtitle: 'Підзаголовок', text: 'Текст', text2: 'Текст 2',
    ctaPrimary: 'Кнопка 1', ctaSecondary: 'Кнопка 2', cta: 'Заклик / кнопка', button: 'Текст кнопки', items: 'Пункти', link: 'Посилання', hero: 'Перший екран', intro: 'Вступ', categories: 'Напрями',
    philosophy: 'Філософія', why: 'Чому S59', approach: 'Як ми працюємо', packages: 'Пакети', calculator: 'Калькулятор', quote: 'Цитата', sub: 'Підпис', portfolio: 'Портфоліо', testimonials: 'Відгуки',
    instagram: 'Instagram', caption: 'Підпис', story: 'Наша історія', signature: 'Підпис під історією', mission: 'Місія', values: 'Цінності', experience: 'Враження', manager: 'Event Manager', principles: 'Принципи',
    where: 'Де ми працюємо', vision: 'Бачення', fullService: 'Повний цикл', extras: 'Додаткові послуги', slug: 'Адреса сторінки (латиницею, без пробілів)', short: 'Короткий опис (для картки)',
    tags: 'Перелік (через ·)', listTitle: 'Заголовок списку', extraTitle: 'Заголовок другого списку', extraList: 'Другий список', noteTitle: 'Заголовок примітки', noteText: 'Текст примітки', key: 'Ключ',
    name: 'Назва', includesTitle: 'Заголовок переліку', includes: 'Що входить', compare: 'Порівняльна таблиця', headers: 'Заголовки колонок', rows: 'Рядки', pricing: 'Як формується вартість', factors: 'Фактори',
    after: 'Текст після списку', help: 'Блок «Не знаєте, що обрати?»', calc: 'Кнопка калькулятора', steps: 'Етапи', comms: 'Комунікація', all: 'Фільтр «Усі»', empty: 'Текст, коли проєктів немає',
    briefLabel: 'Підпис «Запит»', conceptLabel: 'Підпис «Концепція»', detailsLabel: 'Підпис «Деталі»', guestsLabel: 'Підпис «Гостей»', backLabel: 'Кнопка «Усі проєкти»', q: 'Питання', a: 'Відповідь',
    form: 'Форма', direct: 'Блок контактів', thanks: 'Сторінка «Дякуємо»', autoReply: 'Автовідповідь клієнту на email', subject: 'Тема листа', body: 'Текст', privacy: 'Політика конфіденційності', cookies: 'Cookies', terms: 'Умови',
  };
  function label(k) { return LBL[k] || String(k).replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function blank(v) {
    if (Array.isArray(v)) return v.length ? [blank(v[0])] : [];
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = blank(v[k]); }); return o; }
    if (typeof v === 'number') return 0;
    if (typeof v === 'boolean') return false;
    return '';
  }
  function templateAt(def, path) {
    var cur = def;
    for (var i = 0; i < path.length; i++) { if (cur == null) return undefined; cur = Array.isArray(cur) ? cur[0] : cur[path[i]]; }
    return cur;
  }
  VIEWS.content = function () {
    var lang = S.langs[0], page = 'home', data = null, defaults = null, panel = h('div');
    function load() {
      main.innerHTML = '<p class="muted">Завантаження…</p>';
      Promise.all([api('GET', '/content/' + lang), api('GET', '/content-default/' + lang)]).then(function (r) { data = r[0]; defaults = r[1]; setDirty(false); draw(); });
    }
    function node(parent, key, path, rerender) {
      var v = parent[key];
      if (typeof v === 'string' || typeof v === 'number') return field(label(key), text(parent, key, { type: typeof v === 'number' ? 'number' : 'text' }));
      if (typeof v === 'boolean') return toggle(label(key), parent, key);
      if (Array.isArray(v)) return arrayNode(parent, key, path, rerender);
      if (v && typeof v === 'object') {
        return h('div', { class: 'grp' }, h('div', { class: 'grp-h' }, label(key)),
          Object.keys(v).map(function (k) { return node(v, k, path.concat(k), rerender); }));
      }
      return null;
    }
    function arrayNode(parent, key, path, rerender) {
      var arr = parent[key];
      var box = h('div', { class: 'grp' });
      function redraw() { var n = arrayNode(parent, key, path, rerender); box.replaceWith(n); }
      function tpl() {
        var t = arr.length ? arr[0] : templateAt(defaults, path.concat(0));
        return t === undefined ? '' : blank(t);
      }
      var isStr = arr.length ? typeof arr[0] === 'string' : typeof templateAt(defaults, path.concat(0)) !== 'object';
      var isRow = arr.length && Array.isArray(arr[0]);
      var list = h('div', { class: 'arr' });
      arr.forEach(function (item, i) {
        var ctrls = h('span', { class: 'row' },
          h('button', { class: 'btn sm ico', title: 'Вгору', disabled: i === 0, onclick: function () { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); setDirty(true); redraw(); } }, '↑'),
          h('button', { class: 'btn sm ico', title: 'Вниз', disabled: i === arr.length - 1, onclick: function () { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); setDirty(true); redraw(); } }, '↓'),
          h('button', { class: 'btn sm ico danger', title: 'Видалити', onclick: function () { if (confirm('Видалити цей пункт?')) { arr.splice(i, 1); setDirty(true); redraw(); } } }, '✕'));
        if (typeof item === 'string') add(list, h('div', { class: 'strrow' }, text(arr, i), ctrls));
        else if (isRow) add(list, h('div', { class: 'strrow' }, h('div', { class: 'cells' }, item.map(function (_, j) { return text(item, j); })), ctrls));
        else {
          var ttl = item.title || item.name || item.q || item.slug || ('Пункт ' + (i + 1));
          var it = h('div', { class: 'arr-item' + (arr.length > 3 ? ' collapsed' : '') });
          add(it, h('div', { class: 'ai-h' }, h('span', { class: 'ttl', onclick: function () { it.classList.toggle('collapsed'); } }, '▸ ' + String(ttl).replace(/\*/g, '')), ctrls));
          Object.keys(item).forEach(function (k) { add(it, node(item, k, path.concat(i, k), redraw)); });
          add(list, it);
        }
      });
      add(box, [h('div', { class: 'grp-h' }, label(key) + ' (' + arr.length + ')',
        h('button', { class: 'btn sm', onclick: function () { arr.push(isStr ? '' : tpl()); setDirty(true); redraw(); } }, '+ Додати')), list]);
      return box;
    }
    function draw() {
      main.innerHTML = '';
      var pg = PAGES.filter(function (p) { return p[0] === page; })[0];
      add(main, head('Тексти сайту', 'Тут можна змінити будь-який текст на сайті окремо для кожної мови. Порада: <code>*слово*</code> — курсив (як у заголовках бренду), <code>**слово**</code> — жирний, порожній рядок — новий абзац. Щоб прибрати текст із сайту, просто очистіть поле.',
        [h('a', { class: 'btn', href: '/' + lang + pg[2], target: '_blank' }, '↗ Переглянути сторінку')]));
      add(main, langTabs(lang, function (l) { if (S.dirty && !confirm('Є незбережені зміни. Перемкнути мову без збереження?')) return; lang = l; load(); }));
      var pages = h('div', { class: 'ed-pages' }, PAGES.map(function (p) {
        return h('button', { class: p[0] === page ? 'on' : '', onclick: function () { page = p[0]; draw(); } }, p[1]);
      }));
      panel = h('div', { style: 'display:grid;gap:14px;min-width:0' });
      if (page === 'services') add(panel, h('div', { class: 'notice' }, 'Порада: якщо додаєте нову послугу, додайте її в усі мови з тією самою «адресою сторінки» (slug). Фото послуги та ціни для калькулятора задаються в розділах «Дизайн» і «Калькулятор».'));
      var root = data[page];
      if (Array.isArray(root)) add(panel, arrayNode(data, page, [page], draw));
      else Object.keys(root).forEach(function (k) { add(panel, node(root, k, [page, k], draw)); });
      add(panel, h('div', {}, h('button', { class: 'btn danger', onclick: function () {
        if (!confirm('Повернути початкові тексти для розділу «' + pg[1] + '» (' + LANG_FULL[lang] + ')? Ваші зміни в цьому розділі буде замінено.')) return;
        data[page] = clone(defaults[page]); setDirty(true); draw();
      } }, 'Відновити початкові тексти цього розділу')));
      add(main, h('div', { class: 'ed-layout' }, pages, panel));
      add(main, savebar(function () { return api('PUT', '/content/' + lang, data); }));
    }
    load();
  };

  /* ---------- multilingual helpers for projects/testimonials ---------- */
  function ml(obj, key) { if (!obj[key] || typeof obj[key] !== 'object') obj[key] = {}; return obj[key]; }
  function slugify(s) {
    var map = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ё: 'e', ъ: '', ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
    return String(s || '').toLowerCase().split('').map(function (c) { return map[c] !== undefined ? map[c] : c; }).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  }
  function collectionView(opts) {
    var list = [], lang = S.langs[0], openIdx = -1;
    function draw() {
      main.innerHTML = '';
      add(main, head(opts.title, opts.desc, [h('button', { class: 'btn pri', onclick: function () { list.unshift(opts.blank()); openIdx = 0; setDirty(true); draw(); } }, '+ ' + opts.addLabel)]));
      if (!list.length) add(main, h('div', { class: 'empty' }, opts.empty));
      list.forEach(function (item, i) {
        var card = h('div', { class: 'card' });
        var bar = h('div', { class: 'row' },
          opts.thumb(item),
          h('div', { class: 'grow' }, h('b', {}, opts.name(item) || '(без назви)'), h('br'), h('span', { class: 'muted' }, item.published === false ? 'Чернетка — не показується на сайті' : 'Опубліковано')),
          h('button', { class: 'btn sm ico', disabled: i === 0, onclick: function () { list.splice(i - 1, 0, list.splice(i, 1)[0]); setDirty(true); draw(); } }, '↑'),
          h('button', { class: 'btn sm ico', disabled: i === list.length - 1, onclick: function () { list.splice(i + 1, 0, list.splice(i, 1)[0]); setDirty(true); draw(); } }, '↓'),
          h('button', { class: 'btn sm', onclick: function () { openIdx = openIdx === i ? -1 : i; draw(); } }, openIdx === i ? 'Згорнути' : 'Редагувати'),
          h('button', { class: 'btn sm danger', onclick: function () { if (confirm('Видалити «' + (opts.name(item) || 'запис') + '»?')) { list.splice(i, 1); setDirty(true); draw(); } } }, 'Видалити'));
        add(card, bar);
        if (openIdx === i) {
          var body = h('div', { class: 'mt', style: 'display:grid;gap:14px' });
          add(body, toggle('Опубліковано на сайті', item, 'published'));
          add(body, opts.edit(item, lang, function (l) { lang = l; draw(); }));
          add(card, body);
        }
        add(main, card);
      });
      add(main, savebar(function () { if (opts.beforeSave) opts.beforeSave(list); return api('PUT', opts.url, list).then(function () { draw(); }); }));
    }
    api('GET', opts.url).then(function (l) { list = l; draw(); });
  }

  VIEWS.portfolio = function () {
    collectionView({
      title: 'Портфоліо', url: '/projects', addLabel: 'Новий проєкт',
      desc: 'Проєкти з фото й відео. Сторінка «Портфоліо» і блок на головній з’являються автоматично, щойно є хоча б один опублікований проєкт.',
      empty: 'Проєктів ще немає. Натисніть «Новий проєкт», додайте фото та опис.',
      beforeSave: function (list) { var seen = {}; list.forEach(function (p) { if (!p.slug) p.slug = slugify(p.title && (p.title.en || p.title.pl || p.title.uk || p.title.ru)) || p.id; p.slug = slugify(p.slug) || p.id; if (seen[p.slug]) p.slug += '-' + p.id; seen[p.slug] = 1; }); },
      blank: function () { return { id: Date.now().toString(36), slug: '', published: false, category: (S.slugs[0] || {}).slug || '', location: 'Warsaw', guests: '', cover: '', video: '', images: [], title: {}, summary: {}, brief: {}, concept: {}, details: {} }; },
      name: function (p) { return (p.title && (p.title.en || p.title.uk || p.title.pl || p.title.ru)) || ''; },
      thumb: function (p) { return preview(p.cover); },
      edit: function (p, lang, setLang) {
        var imgs = h('div', { class: 'thumbs' });
        function drawImgs() {
          imgs.innerHTML = '';
          (p.images || []).forEach(function (u, i) {
            add(imgs, h('div', { class: 't' }, isVideo(u) ? h('video', { src: u, muted: true }) : h('img', { src: u, alt: '' }),
              h('div', { class: 'x' },
                h('button', { title: 'Ліворуч', onclick: function () { if (i) { p.images.splice(i - 1, 0, p.images.splice(i, 1)[0]); setDirty(true); drawImgs(); } } }, '‹'),
                h('button', { title: 'Прибрати', onclick: function () { p.images.splice(i, 1); setDirty(true); drawImgs(); } }, '×'))));
          });
          add(imgs, h('button', { class: 'btn', onclick: function () { pickMedia('any', true).then(function (arr) { if (arr && arr.length) { p.images = (p.images || []).concat(arr); setDirty(true); drawImgs(); } }); } }, '+ Додати фото / відео'));
        }
        drawImgs();
        var t = ml(p, 'title');
        return h('div', { style: 'display:grid;gap:14px' },
          h('div', { class: 'grid3' },
            field('Адреса сторінки (slug)', text(p, 'slug', { placeholder: 'наприклад: summer-gala-2026' }), 'Латиницею. Залиште порожнім — створиться з англійської назви.'),
            field('Категорія', select(p, 'category', S.slugs.map(function (s) { return [s.slug, s.title]; }))),
            tf('Місто / локація', p, 'location')),
          h('div', { class: 'grid2' }, tf('Кількість гостей', p, 'guests'), h('div')),
          h('div', { class: 'grid2' }, mediaField('Обкладинка (фото або відео)', p, 'cover', 'any'), mediaField('Відео проєкту (необов’язково)', p, 'video', 'video')),
          field('Галерея', imgs, 'Перше фото — головне в галереї. Можна додавати і відео.'),
          langTabs(lang, setLang),
          tf('Назва (' + LANG_NAMES[lang] + ')', t, lang),
          tf('Короткий опис (' + LANG_NAMES[lang] + ')', ml(p, 'summary'), lang, { area: true }),
          tf('Запит клієнта (' + LANG_NAMES[lang] + ')', ml(p, 'brief'), lang, { area: true }),
          tf('Концепція (' + LANG_NAMES[lang] + ')', ml(p, 'concept'), lang, { area: true }),
          tf('Деталі (' + LANG_NAMES[lang] + ')', ml(p, 'details'), lang, { area: true }));
      },
    });
  };

  VIEWS.testimonials = function () {
    collectionView({
      title: 'Відгуки', url: '/testimonials', addLabel: 'Новий відгук',
      desc: 'Відгуки клієнтів. Блок на головній з’являється, коли є хоча б один опублікований відгук. Публікуйте лише з дозволу клієнта.',
      empty: 'Відгуків ще немає.',
      blank: function () { return { id: Date.now().toString(36), published: true, name: '', photo: '', event: {}, text: {} }; },
      name: function (t) { return t.name; },
      thumb: function (t) { return preview(t.photo); },
      edit: function (t, lang, setLang) {
        return h('div', { style: 'display:grid;gap:14px' },
          h('div', { class: 'grid2' }, tf('Імʼя клієнта (як показувати)', t, 'name', { placeholder: 'наприклад: Anna K.' }), mediaField('Фото (необов’язково)', t, 'photo', 'image')),
          langTabs(lang, setLang),
          tf('Подія (' + LANG_NAMES[lang] + ')', ml(t, 'event'), lang, { placeholder: 'наприклад: Private dinner, Warsaw' }),
          tf('Текст відгуку (' + LANG_NAMES[lang] + ')', ml(t, 'text'), lang, { area: true, help: 'Якщо для якоїсь мови текст порожній, буде показано англійський.' }));
      },
    });
  };

  /* ---------- media ---------- */
  VIEWS.media = function () {
    var grid = h('div', { class: 'media-grid' });
    function load() {
      api('GET', '/media').then(function (list) {
        grid.innerHTML = '';
        if (!list.length) add(grid, h('p', { class: 'muted' }, 'Файлів ще немає.'));
        list.forEach(function (m) {
          add(grid, h('div', { class: 'mi' }, h('a', { class: 'th', href: m.url, target: '_blank' }, thumb(m)),
            h('div', { class: 'meta', title: m.original }, m.original + ' · ' + (m.size / 1048576).toFixed(1) + ' МБ'),
            h('div', { class: 'acts' },
              h('button', { class: 'btn sm', onclick: function () { var u = location.origin + m.url; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { toast('Посилання скопійовано'); }, function () { prompt('Посилання:', u); }); } }, 'Копіювати URL'),
              h('button', { class: 'btn sm danger', onclick: function () { if (confirm('Видалити файл? Якщо він використовується на сайті, там зникне зображення.')) api('DELETE', '/media/' + m.id).then(load); } }, '✕'))));
        });
      });
    }
    main.innerHTML = '';
    add(main, [head('Фото та відео', 'Бібліотека файлів сайту. Підтримуються JPG, PNG, WEBP, AVIF, SVG, GIF, MP4, WEBM, MOV, шрифти WOFF/WOFF2/TTF. Порада: стискайте фото до 2500 px по довшій стороні — сайт працюватиме швидше.'),
      S.persistent ? null : h('div', { class: 'notice' }, '⚠ Постійне сховище не підключено: завантажені файли зникнуть після перезапуску сервера. На Railway додайте Volume (див. розділ «Безпека та копії»).'),
      uploader(load, 'image/*,video/*,.woff,.woff2,.ttf,.otf'), grid]);
    load();
  };

  /* ---------- design ---------- */
  var SECTION_NAMES = { intro: 'Вступ', categories: 'Напрями (картки послуг)', philosophy: 'Філософія', why: 'Чому S59', approach: 'Як ми працюємо (коротко)', packages: 'Пакети', calculator: 'Калькулятор (анонс)', quote: 'Цитата', portfolio: 'Портфоліо (видно, коли є проєкти)', testimonials: 'Відгуки (видно, коли є опубліковані)', instagram: 'Instagram', cta: 'Фінальний заклик' };
  var FONTS = ['Cormorant Infant', 'Cormorant Garamond', 'Cormorant', 'Playfair Display', 'Bodoni Moda', 'Prata', 'Forum', 'Marcellus', 'Italiana', 'Libre Caslon Display', 'Lora', 'Assistant', 'Jost', 'Manrope', 'Montserrat', 'Inter', 'Raleway', 'Mulish', 'Nunito Sans', 'Tenor Sans', 'Lato', 'Open Sans', 'Roboto'];
  function fontPreview(f) {
    var box = h('div', { class: 'card', style: 'background:' + S.settings.theme.colors.bg + ';color:' + S.settings.theme.colors.sand });
    function draw() {
      var fam = [f.heading, f.body, f.fallback].filter(Boolean).map(function (n) { return 'family=' + encodeURIComponent(n).replace(/%20/g, '+'); }).join('&');
      var id = 'fprev';
      var link = document.getElementById(id) || document.head.appendChild(h('link', { id: id, rel: 'stylesheet' }));
      link.href = 'https://fonts.googleapis.com/css2?' + fam + '&display=swap';
      box.innerHTML = '';
      add(box, [h('div', { style: 'font-family:"' + f.heading + '",serif;font-size:42px;line-height:1;text-transform:' + (S.settings.theme.headingCase === 'none' ? 'none' : 'uppercase') + ';color:' + S.settings.theme.colors.white }, 'Where every ', h('i', { style: 'text-transform:none' }, 'detail'), ' matters'),
        h('div', { style: 'font-family:"' + f.heading + '",serif;font-size:28px;margin-top:6px' }, 'Де кожна деталь · Gdzie każdy detal'),
        h('p', { style: 'font-family:"' + f.body + '","' + (f.fallback || 'sans-serif') + '",sans-serif;font-size:16px;margin:12px 0 0' }, 'We create extraordinary experiences. Ми створюємо незабутні події. Tworzymy wyjątkowe wydarzenia.')]);
    }
    draw();
    box.redraw = draw;
    return box;
  }
  VIEWS.design = function () {
    var st = S.settings, th = st.theme, m = st.media;
    var order = h('div', { class: 'sec-order' });
    function drawOrder() {
      order.innerHTML = '';
      st.homeSections.forEach(function (s, i) {
        add(order, h('div', { class: 'so' }, toggle('', s, 'on'), h('span', { class: 'nm' }, SECTION_NAMES[s.key] || s.key),
          h('button', { class: 'btn sm ico', disabled: i === 0, onclick: function () { st.homeSections.splice(i - 1, 0, st.homeSections.splice(i, 1)[0]); setDirty(true); drawOrder(); } }, '↑'),
          h('button', { class: 'btn sm ico', disabled: i === st.homeSections.length - 1, onclick: function () { st.homeSections.splice(i + 1, 0, st.homeSections.splice(i, 1)[0]); setDirty(true); drawOrder(); } }, '↓')));
      });
    }
    drawOrder();
    var fp = fontPreview(th.fonts);
    var dl = h('datalist', { id: 'fontlist' }, FONTS.map(function (f) { return h('option', { value: f }); }));
    function fontInput(key) { var i = text(th.fonts, key, { onchange: function () { clearTimeout(fontInput.t); fontInput.t = setTimeout(fp.redraw, 500); } }); i.setAttribute('list', 'fontlist'); return i; }
    main.innerHTML = '';
    add(main, [head('Дизайн', 'Кольори, шрифти, логотип, головні фото й відео, порядок блоків на головній сторінці.', [h('a', { class: 'btn', href: '/', target: '_blank' }, '↗ Переглянути сайт')]), dl,
      h('div', { class: 'card' }, h('h2', {}, 'Кольори'), h('p', { class: 'hint' }, 'Палітра бренду S59. Зміни застосовуються до всього сайту.'),
        h('div', { class: 'grid3' }, colorField('Основний фон', th.colors, 'bg'), colorField('Другий фон (блоки)', th.colors, 'bg2'), colorField('Найтемніший (цитати)', th.colors, 'ink'),
          colorField('Текст і логотип (пісочний)', th.colors, 'sand'), colorField('Другорядний текст', th.colors, 'stone'), colorField('Заголовки', th.colors, 'white'))),
      h('div', { class: 'card' }, h('h2', {}, 'Шрифти'), h('p', { class: 'hint', html: 'Будь-який шрифт з <a href="https://fonts.google.com" target="_blank">Google Fonts</a> — впишіть точну назву. Для української та російської версій потрібна кирилиця: Assistant її не має, тому кирилицю показує «запасний шрифт».' }),
        h('div', { class: 'grid3' }, field('Заголовки', fontInput('heading')), field('Основний текст', fontInput('body')), field('Запасний шрифт (кирилиця)', fontInput('fallback'))),
        h('div', { class: 'grid3 mt' },
          field('Регістр заголовків', select(th, 'headingCase', [['uppercase', 'ВЕЛИКІ ЛІТЕРИ'], ['none', 'Як написано']])),
          tf('Розмір заголовків (1 = стандарт)', th, 'headingScale', { type: 'number', help: 'Наприклад 0.9 — менші, 1.15 — більші' }),
          tf('Висота логотипа в шапці, px', th, 'logoHeight', { type: 'number' })),
        h('details', { class: 'mt' }, h('summary', { class: 'muted' }, 'Розширено: начертання шрифтів'), h('div', { class: 'grid3 mt' }, tf('Заголовки', th.fonts, 'headingAxes'), tf('Текст', th.fonts, 'bodyAxes'), tf('Запасний', th.fonts, 'fallbackAxes'))),
        fp),
      h('div', { class: 'card' }, h('h2', {}, 'Логотип і головні зображення'), h('p', { class: 'hint' }, 'Можна обрати фото або відео з медіатеки. Відео на першому екрані відтворюється без звуку по колу, а фото показується, поки відео завантажується.'),
        h('div', { class: 'grid2' },
          mediaField('Логотип', th, 'logo', 'image', 'Найкраще — SVG або PNG з прозорим фоном'),
          mediaField('Перший екран — фото', m, 'heroImage', 'image'),
          mediaField('Перший екран — відео (необов’язково)', m, 'heroVideo', 'video'),
          mediaField('Фото для «Філософія» та «Про нас»', m, 'aboutImage', 'any'),
          mediaField('Фото засновниці (сторінка «Про нас»)', m, 'founderImage', 'image'),
          mediaField('Фон фінального заклику (необов’язково)', m, 'ctaImage', 'any'),
          mediaField('Картинка для соцмереж (коли діляться посиланням)', m, 'ogImage', 'image'))),
      h('div', { class: 'card' }, h('h2', {}, 'Фото послуг'), h('p', { class: 'hint' }, 'Фото або відео для карток послуг і першого екрана сторінки кожної послуги. Без фото картка буде темною з текстом.'),
        h('div', { class: 'grid2' }, S.slugs.map(function (s) { return mediaField(s.title, m.serviceImages, s.slug, 'any'); }))),
      h('div', { class: 'card' }, h('h2', {}, 'Блоки головної сторінки'), h('p', { class: 'hint' }, 'Вмикайте, вимикайте та змінюйте порядок блоків.'), order),
      h('div', { class: 'card' }, h('h2', {}, 'Інше'),
        h('div', { style: 'display:grid;gap:12px' }, toggle('Кнопка WhatsApp у кутку екрана', st.contacts, 'showWhatsappButton'), toggle('Показувати повідомлення про cookies', st, 'cookieBanner')),
        h('div', { class: 'mt' }, tf('Власний CSS (для дизайнера)', th, 'customCss', { area: true, help: 'Необов’язково. Додається в кінці стилів сайту.' }))),
      savebar(saveSettings)]);
  };

  /* ---------- calculator ---------- */
  VIEWS.calculator = function () {
    var k = S.settings.calculator;
    var ex = h('div', { class: 'arr' });
    var demo = h('div', { class: 'card' });
    function money(n) { return Math.round(n).toLocaleString('uk-UA') + ' ' + k.currency; }
    function drawDemo() {
      demo.innerHTML = '';
      add(demo, [h('h2', {}, 'Приклад розрахунку: 50 гостей'), h('p', { class: 'hint' }, 'Так виглядатиме діапазон на сайті без додаткових опцій.')]);
      add(demo, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Подія'), Object.keys(k.packages).map(function (p) { return h('th', {}, p.charAt(0).toUpperCase() + p.slice(1)); }))),
        h('tbody', {}, S.slugs.map(function (s) {
          var t = k.types[s.slug] || { base: 0, perGuest: 0 };
          return h('tr', {}, h('td', {}, s.title), Object.keys(k.packages).map(function (p) {
            var tot = (Number(t.base) + Number(t.perGuest) * 50) * Number(k.packages[p]);
            return h('td', {}, money(tot * (1 - k.spread / 2)) + ' – ' + money(tot * (1 + k.spread / 2)));
          }));
        })))));
    }
    function drawExtras() {
      ex.innerHTML = '';
      k.extras.forEach(function (e, i) {
        add(ex, h('div', { class: 'arr-item' },
          h('div', { class: 'ai-h' }, h('span', { class: 'ttl' }, e.label.uk || e.label.en || e.key || 'Опція'), h('button', { class: 'btn sm danger', onclick: function () { k.extras.splice(i, 1); setDirty(true); drawExtras(); } }, 'Видалити')),
          h('div', { class: 'grid3' }, tf('Ціна, ' + k.currency, e, 'price', { type: 'number', onchange: drawDemo }), h('div', { class: 'f' }, h('span', { class: 'lbl' }, 'Як рахувати'), toggle('за кожного гостя', e, 'perGuest')), tf('Ключ (латиницею)', e, 'key')),
          h('div', { class: 'grid2' }, S.langs.map(function (l) { return tf('Назва ' + LANG_NAMES[l], e.label, l); }))));
      });
    }
    var types = h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Тип події'), h('th', {}, 'Базова сума, ' + k.currency), h('th', {}, 'За гостя, ' + k.currency))),
      h('tbody', {}, S.slugs.map(function (s) {
        if (!k.types[s.slug]) k.types[s.slug] = { base: 0, perGuest: 0 };
        var t = k.types[s.slug];
        return h('tr', {}, h('td', {}, s.title), h('td', {}, text(t, 'base', { type: 'number', onchange: drawDemo })), h('td', {}, text(t, 'perGuest', { type: 'number', onchange: drawDemo })));
      }))));
    drawExtras(); drawDemo();
    var spreadObj = { pct: Math.round(k.spread * 100) };
    main.innerHTML = '';
    add(main, [head('Калькулятор вартості', 'Клієнт обирає тип події, кількість гостей, пакет і додаткові опції та бачить орієнтовний діапазон «від — до». Формула: (базова сума + ціна за гостя × гості) × коефіцієнт пакета + опції.', [h('a', { class: 'btn', href: '/' + S.settings.languages.default + '/estimate', target: '_blank' }, '↗ Переглянути')]),
      h('div', { class: 'notice' }, '⚠ Зараз стоять приклади цін. Перед запуском впишіть свої реальні ціни після розрахунку собівартості.'),
      h('div', { class: 'card' }, h('h2', {}, 'Основне'), h('div', { class: 'grid3' },
        h('div', { class: 'f' }, h('span', { class: 'lbl' }, 'Показувати калькулятор'), toggle('увімкнено', k, 'enabled')), tf('Валюта', k, 'currency'),
        field('Ширина діапазону, %', text(spreadObj, 'pct', { type: 'number', onchange: function () { k.spread = Number(spreadObj.pct) / 100; drawDemo(); } }), 'Наприклад 25 — показує суму ± 12,5%'),
        tf('Мінімум гостей', k, 'minGuests', { type: 'number' }), tf('Максимум гостей', k, 'maxGuests', { type: 'number' }), tf('Гостей за замовчуванням', k, 'defaultGuests', { type: 'number' }))),
      h('div', { class: 'card' }, h('h2', {}, 'Ціни за типом події'), types),
      h('div', { class: 'card' }, h('h2', {}, 'Коефіцієнти пакетів'), h('p', { class: 'hint' }, '1 = базова ціна. Наприклад 1.5 — на 50% дорожче.'), h('div', { class: 'grid3' }, Object.keys(k.packages).map(function (p) { return tf(p.charAt(0).toUpperCase() + p.slice(1), k.packages, p, { type: 'number', onchange: drawDemo }); }))),
      h('div', { class: 'card' }, h('h2', {}, 'Додаткові опції'), ex, h('button', { class: 'btn mt', onclick: function () { k.extras.push({ key: 'option' + (k.extras.length + 1), price: 0, perGuest: false, label: { en: '', pl: '', uk: '', ru: '' } }); setDirty(true); drawExtras(); } }, '+ Додати опцію')),
      demo, savebar(saveSettings)]);
  };

  /* ---------- contacts ---------- */
  VIEWS.contacts = function () {
    var c = S.settings.contacts, co = S.settings.company;
    main.innerHTML = '';
    add(main, [head('Контакти', 'Показуються в шапці, футері, на сторінці заявки, у калькуляторі та в кнопці WhatsApp.'),
      c.email ? null : h('div', { class: 'notice' }, 'Впишіть email агенції: зараз його не видно на сайті.'),
      h('div', { class: 'card' }, h('div', { class: 'grid2' },
        tf('Телефон (як показувати)', c, 'phone', { placeholder: '+48 512 479 118' }),
        tf('WhatsApp (лише цифри з кодом країни)', c, 'whatsapp', { placeholder: '48512479118' }),
        tf('Email', c, 'email', { type: 'email', placeholder: 'hello@...' }),
        tf('Telegram (необов’язково)', c, 'telegram', { placeholder: '@username' }),
        tf('Instagram — посилання', c, 'instagramUrl'),
        tf('Instagram — нікнейм', c, 'instagramHandle'))),
      h('div', { class: 'card' }, h('h2', {}, 'Дані компанії'), h('p', { class: 'hint' }, 'Для футера та юридичних сторінок (у Польщі бажано вказати назву, NIP та адресу).'),
        h('div', { class: 'grid3' }, tf('Юридична назва', co, 'legalName'), tf('NIP', co, 'nip'), tf('Адреса', co, 'address'))),
      h('p', { class: 'muted' }, 'Адресу студії та години роботи для кожної мови можна змінити в «Тексти сайту → Форма заявки → Блок контактів».'),
      savebar(saveSettings)]);
  };

  /* ---------- integrations ---------- */
  VIEWS.integrations = function () {
    var i = S.settings.integrations, m = i.smtp;
    var log = h('div', { class: 'log', hidden: true });
    main.innerHTML = '';
    add(main, [head('CRM та сповіщення', 'Куди надсилати нові заявки, крім цієї адмін-панелі. Можна увімкнути кілька способів одночасно.'),
      h('div', { class: 'card' }, h('h2', {}, 'CRM (webhook)'),
        h('p', { class: 'hint', html: 'Кожна нова заявка надсилається у форматі JSON на вказану адресу. Так підключаються <b>HubSpot, Pipedrive, Bitrix24, KeyCRM, amoCRM/Kommo, Notion, Google Sheets</b> — напряму (якщо CRM дає адресу вхідного webhook) або через <b>Make.com</b> чи <b>Zapier</b> (сценарій «Webhook → CRM»).' }),
        h('div', { class: 'grid2' }, tf('Адреса webhook', i, 'webhookUrl', { placeholder: 'https://hook.eu1.make.com/…' }), tf('Секретний ключ (необов’язково)', i, 'webhookSecret', { help: 'Надсилається в заголовку X-S59-Secret' })),
        h('details', { class: 'mt' }, h('summary', { class: 'muted' }, 'Які поля надсилаються'), h('div', { class: 'log mt' }, '{ "event": "enquiry.created", "id": 12, "lang": "pl", "created_at": "…",\n  "name", "email", "phone", "company", "contactPref", "eventType", "eventTypeLabel",\n  "date", "guests", "guestsExact", "location", "venue", "package", "packageLabel",\n  "budget", "estimate", "vision", "source", "page" }'))),
      h('div', { class: 'card' }, h('h2', {}, 'Telegram'),
        h('p', { class: 'hint', html: '1) У Telegram напишіть <b>@BotFather</b> → /newbot → отримаєте токен. 2) Напишіть своєму боту будь-яке повідомлення (або додайте його в групу). 3) Відкрийте <code>https://api.telegram.org/bot&lt;ТОКЕН&gt;/getUpdates</code> і скопіюйте <code>chat.id</code>.' }),
        h('div', { class: 'grid2' }, tf('Токен бота', i, 'telegramToken'), tf('Chat ID', i, 'telegramChatId'))),
      h('div', { class: 'card' }, h('h2', {}, 'Email'),
        h('p', { class: 'hint', html: 'Для Gmail: host <code>smtp.gmail.com</code>, порт <code>465</code>, логін — ваша пошта, пароль — <a href="https://myaccount.google.com/apppasswords" target="_blank">пароль застосунку</a> (не звичайний пароль).' }),
        h('div', { class: 'grid3' }, tf('SMTP сервер', m, 'host'), tf('Порт', m, 'port', { type: 'number' }), tf('Логін', m, 'user'), tf('Пароль', m, 'pass', { type: 'password' }), tf('Від кого (email)', m, 'from'), tf('Куди надсилати заявки', m, 'to', { help: 'Якщо порожньо — на email з розділу «Контакти»' })),
        h('div', { class: 'mt' }, toggle('Надсилати клієнту автоматичну відповідь «Дякуємо за заявку» (текст — у «Тексти сайту → Форма заявки»)', m, 'autoReply'))),
      h('div', { class: 'card' }, h('h2', {}, 'Перевірка'), h('p', { class: 'hint' }, 'Спершу збережіть налаштування, потім надішліть тестову заявку в усі підключені канали.'),
        h('button', { class: 'btn', onclick: function () { log.hidden = false; log.textContent = 'Надсилаю…'; api('POST', '/test-notify').then(function (r) { log.textContent = r.log; }).catch(function (e) { log.textContent = e.message; }); } }, 'Надіслати тест'), h('div', { class: 'mt' }, log)),
      savebar(saveSettings)]);
  };

  /* ---------- languages & seo ---------- */
  VIEWS.languages = function () {
    var L = S.settings.languages, seo = S.settings.seo;
    var boxes = h('div', { style: 'display:grid;gap:10px' }, S.langs.map(function (l) {
      var o = { on: L.enabled.indexOf(l) > -1 };
      return toggle(LANG_FULL[l] + ' (/' + l + '/)', o, 'on', function () {
        L.enabled = S.langs.filter(function (x) { return x === l ? o.on : L.enabled.indexOf(x) > -1; });
        if (!L.enabled.length) { L.enabled = [l]; o.on = true; toast('Має бути хоча б одна мова', true); go(); }
      });
    }));
    main.innerHTML = '';
    add(main, [head('Мови та SEO'),
      h('div', { class: 'card' }, h('h2', {}, 'Мови сайту'), boxes,
        h('div', { class: 'grid2 mt' }, field('Мова за замовчуванням', select(L, 'default', S.langs.map(function (l) { return [l, LANG_FULL[l]]; })), 'Відкривається, якщо мову браузера відвідувача не підтримано'))),
      h('div', { class: 'card' }, h('h2', {}, 'SEO та аналітика'),
        h('div', { class: 'grid2' }, tf('Адреса сайту (домен)', seo, 'siteUrl', { placeholder: 'https://s59events.com', help: 'Для Google і правильних посилань. Без «/» в кінці.' }),
          h('div', { class: 'f' }, h('span', { class: 'lbl' }, 'Приховати сайт від Google'), toggle('так (поки сайт не готовий)', seo, 'noindex'))),
        h('div', { class: 'mt' }, tf('Код у <head> (Google Analytics, Meta Pixel, Search Console)', seo, 'customHead', { area: true, help: 'Вставте код лічильника. Якщо додаєте аналітику, увімкніть повідомлення про cookies у «Дизайн → Інше» та оновіть політику cookies.' })),
        h('p', { class: 'muted mt' }, 'Заголовки та описи сторінок для Google редагуються в «Тексти сайту» → блок «SEO» на кожній сторінці. Карта сайту: ', h('a', { href: '/sitemap.xml', target: '_blank' }, '/sitemap.xml'))),
      savebar(saveSettings)]);
  };

  /* ---------- security ---------- */
  VIEWS.security = function () {
    var pw = { current: '', next: '' };
    var file = h('input', { type: 'file', accept: 'application/json', onchange: function () {
      var f = file.files[0]; if (!f) return;
      if (!confirm('Відновити все з копії «' + f.name + '»? Поточні тексти, налаштування, портфоліо та відгуки буде замінено.')) return;
      f.text().then(function (t) { return api('POST', '/restore', JSON.parse(t)); }).then(function () { toast('Відновлено'); setTimeout(function () { location.reload(); }, 800); }).catch(function (e) { toast(e.message, true); });
    } });
    main.innerHTML = '';
    add(main, [head('Безпека та резервні копії'),
      S.persistent ? h('div', { class: 'notice ok' }, '✓ Дані зберігаються на постійному диску: ' + S.dataDir)
        : h('div', { class: 'notice', html: '⚠ <b>Постійне сховище не підключено.</b> На Railway додайте Volume до сервісу (правою кнопкою на сервіс → <i>Attach Volume</i>, шлях <code>/data</code>), інакше заявки, тексти та фото зникнуть після перезапуску.' }),
      h('div', { class: 'card' }, h('h2', {}, 'Змінити пароль'), h('div', { class: 'grid2' }, tf('Поточний пароль', pw, 'current', { type: 'password' }), tf('Новий пароль (мінімум 8 символів)', pw, 'next', { type: 'password' })),
        h('button', { class: 'btn pri mt', onclick: function () { api('POST', '/password', pw).then(function () { toast('Пароль змінено'); setDirty(false); pw.current = pw.next = ''; go(); }).catch(function (e) { toast(e.message, true); }); } }, 'Змінити пароль')),
      h('div', { class: 'card' }, h('h2', {}, 'Резервна копія'), h('p', { class: 'hint' }, 'Завантажте файл з усіма текстами, налаштуваннями, портфоліо, відгуками та заявками. Фото й відео зберігаються окремо на диску сервера.'),
        h('div', { class: 'tools' }, h('a', { class: 'btn pri', href: '/admin/api/backup' }, '⇩ Завантажити копію'), h('label', { class: 'btn' }, '⇧ Відновити з копії', file))),
      h('div', { class: 'card' }, h('h2', {}, 'Вихід'), h('button', { class: 'btn', onclick: function () { api('POST', '/logout').then(showLogin); } }, 'Вийти з адмін-панелі'))]);
    file.hidden = true;
  };

  /* ---------------- start ---------------- */
  boot().catch(function (e) { if (e.message !== 'auth') { app.innerHTML = ''; add(app, h('p', { style: 'padding:40px' }, 'Помилка: ' + e.message)); } });
})();
