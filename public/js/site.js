(function () {
  'use strict';
  var d = document;
  d.documentElement.classList.add('js');

  /* header */
  var hdr = d.getElementById('hdr');
  var onScroll = function () { if (hdr) hdr.classList.toggle('is-solid', window.scrollY > 40); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var burger = d.getElementById('burger');
  var drawer = d.getElementById('drawer');
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', String(open));
      drawer.hidden = !open;
      hdr.classList.toggle('is-open', open);
      d.body.style.overflow = open ? 'hidden' : '';
    });
  }

  /* gentle reveal for below-the-fold blocks only */
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var targets = d.querySelectorAll('.sec .wrap > *, .ctab__in');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('rv'); io.observe(el); }
    });
  }

  /* cookie notice */
  var cookie = d.getElementById('cookie');
  if (cookie) {
    var seen = false;
    try { seen = localStorage.getItem('s59cookie') === '1'; } catch (e) {}
    cookie.hidden = seen;
    d.getElementById('cookieOk').addEventListener('click', function () {
      cookie.hidden = true;
      try { localStorage.setItem('s59cookie', '1'); } catch (e) {}
    });
  }

  /* portfolio filters */
  d.querySelectorAll('.filters button').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-filter');
      d.querySelectorAll('.filters button').forEach(function (x) { x.classList.toggle('on', x === b); });
      d.querySelectorAll('.prj').forEach(function (p) { p.hidden = !!f && p.getAttribute('data-cat') !== f; });
    });
  });

  /* lightbox */
  d.querySelectorAll('[data-lightbox]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      var box = d.createElement('div');
      box.className = 'lightbox';
      box.innerHTML = '<img alt="">';
      box.firstChild.src = a.getAttribute('href');
      box.addEventListener('click', function () { box.remove(); });
      d.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { box.remove(); d.removeEventListener('keydown', esc); } });
      d.body.appendChild(box);
    });
  });

  /* calculator */
  var dataEl = d.getElementById('calcData');
  if (dataEl) {
    var D = JSON.parse(dataEl.textContent);
    var form = d.getElementById('calcForm');
    var fmt = new Intl.NumberFormat(D.locale, { maximumFractionDigits: 0 });
    var money = function (n) { return fmt.format(n) + ' ' + D.currency; };
    var round = function (n) { return n >= 20000 ? Math.round(n / 1000) * 1000 : Math.round(n / 100) * 100; };
    var calc = function () {
      var fd = new FormData(form);
      var type = D.types.filter(function (t) { return t.key === fd.get('type'); })[0] || D.types[0];
      var pkg = D.packages.filter(function (p) { return p.key === fd.get('package'); })[0] || D.packages[0];
      var guests = Number(fd.get('guests')) || 0;
      var chosen = fd.getAll('extras');
      var total = (Number(type.base) + Number(type.perGuest) * guests) * pkg.mult;
      D.extras.forEach(function (e) { if (chosen.indexOf(e.key) > -1) total += e.perGuest ? e.price * guests : e.price; });
      var low = round(total * (1 - D.spread / 2));
      var high = round(total * (1 + D.spread / 2));
      d.getElementById('gOut').textContent = guests;
      d.getElementById('low').textContent = money(low);
      d.getElementById('high').textContent = money(high);
      d.getElementById('pg').textContent = guests ? '≈ ' + money(round(total / guests)) + ' ' + D.perGuest : '';
      var lang = d.getElementById('calc').getAttribute('data-lang');
      var q = new URLSearchParams({ type: type.key, package: pkg.key, guests: String(guests), estimate: money(low) + ' – ' + money(high) + ' · ' + pkg.label + (chosen.length ? ' · +' + chosen.length : '') });
      d.getElementById('calcSend').href = '/' + lang + '/enquire?' + q.toString();
    };
    form.addEventListener('input', calc);
    form.addEventListener('change', calc);
    calc();
  }

  /* enquiry form */
  var enq = d.getElementById('enqForm');
  if (enq) {
    var msg = JSON.parse(d.getElementById('formMsg').textContent);
    var err = d.getElementById('formErr');
    enq.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var bad = false;
      enq.querySelectorAll('[required]').forEach(function (f) {
        var ok = f.type === 'checkbox' ? f.checked : f.value.trim() && (f.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value));
        var wrap = f.closest('.fld, .consent');
        if (wrap) wrap.classList.toggle('bad', !ok);
        if (!ok) bad = true;
      });
      if (bad) { err.textContent = msg.err; err.hidden = false; var first = enq.querySelector('.bad'); if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      err.hidden = true;
      var btn = enq.querySelector('button[type="submit"]');
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = btn.getAttribute('data-sending');
      var body = {};
      new FormData(enq).forEach(function (v, k) { body[k] = v; });
      fetch('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || r.status); }); })
        .then(function () { location.href = msg.thanks; })
        .catch(function () { err.textContent = msg.send; err.hidden = false; btn.disabled = false; btn.textContent = label; });
    });
  }
})();
