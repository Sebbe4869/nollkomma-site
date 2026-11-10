/* Nollkomma: "Testa din sajt" och AI-assistenten. Laddas med defer och gör ingenting förrän besökaren använder dem. */
(function () {
  'use strict';
  var API = window.NK_API || '/api';
  var DEMO = !!window.NK_DEMO; // förhandsvisningen saknar API och visar märkta exempel
  var $ = function (id) { return document.getElementById(id); };
  var form = $('koll-form'), input = $('koll-url'), fel = $('koll-fel'), ut = $('koll-ut'), knapp = $('koll-knapp');
  if (!form) return;
  var senaste = null; // senaste testresultatet, följer med till AI-assistenten

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function sek(ms) { return (ms / 1000).toFixed(1).replace('.', ',') + ' s'; }
  function post(path, body) {
    return fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }, function () { return { ok: false, data: {} }; }); });
  }
  var IKON_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4L18.5 8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var IKON_NEJ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>';

  function rad(ok, label, detail) {
    var li = el('li', ok ? 'koll-ok' : 'koll-nej');
    var ikon = el('span', 'koll-ikon'); ikon.innerHTML = ok ? IKON_OK : IKON_NEJ;
    var text = el('div');
    var rubrik = el('p', 'koll-namn');
    rubrik.appendChild(el('span', 'sr-only', ok ? 'Klarar: ' : 'Klarar inte: '));
    rubrik.appendChild(document.createTextNode(label));
    text.appendChild(rubrik); text.appendChild(el('p', 'koll-detalj', detail));
    li.appendChild(ikon); li.appendChild(text);
    return li;
  }

  function visa(data) {
    senaste = { host: data.host, checks: data.checks.map(function (c) { return { label: c.label, ok: c.ok }; }) };
    ut.textContent = '';
    if (DEMO) ut.appendChild(el('p', 'koll-exempel', 'Exempel. I förhandsvisningen körs inget riktigt test.'));
    var h = el('h3', 'koll-summa', data.host + ': ' + data.passed + ' av ' + data.total + ' klarar sig.');
    h.tabIndex = -1;
    ut.appendChild(h);
    var lista = el('ul', 'koll-lista');
    data.checks.forEach(function (c) { lista.appendChild(rad(c.ok, c.label, c.detail)); });
    var fart = el('li', 'koll-vantar');
    var fi = el('span', 'koll-ikon'); fi.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="30 22" stroke-linecap="round"/></svg>';
    var ft = el('div'); ft.appendChild(el('p', 'koll-namn', 'Googles mätning på mobil')); var fd = el('p', 'koll-detalj', 'Hämtar … det tar upp till en halv minut.'); ft.appendChild(fd);
    fart.appendChild(fi); fart.appendChild(ft); lista.appendChild(fart);
    ut.appendChild(lista);
    ut.appendChild(el('p', 'koll-not', 'Testet läser bara det som är öppet för alla. En brandvägg kan stoppa AI-tjänster även om robots.txt släpper in dem, och det syns inte här.'));
    if (data.passed < data.total) ut.appendChild(el('p', 'koll-nasta', 'Det som saknas går att rätta till. Boka ett samtal, så går vi igenom det.'));
    var a = el('div', 'actions');
    var boka = el('a', 'btn', 'Boka 15 minuter'); boka.href = '#kontakt'; a.appendChild(boka);
    ut.appendChild(a);
    ut.hidden = false;
    h.focus({ preventScroll: true });

    function fartKlar(ok, namn, detalj) { var ny = rad(ok, namn, detalj); lista.replaceChild(ny, fart); fart = ny; }
    function fartFel(msg) { fart.className = 'koll-neutral'; fi.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>'; fd.textContent = msg; }
    function fartVisa(d) {
      senaste.poang = d.poang;
      var delar = [d.poang + ' av 100'];
      if (typeof d.lcpMs === 'number') delar.push('det största innehållet syns efter ' + sek(d.lcpMs) + ' (Googles gräns för bra är 2,5 s)');
      fartKlar(d.poang >= 90, 'Googles mätning på mobil', delar.join(', ') + '.');
    }
    if (DEMO) { setTimeout(function () { fartVisa({ poang: 46, lcpMs: 5300 }); }, 900); return; }
    post('/fart', { url: data.url }).then(function (r) {
      if (r.ok && typeof r.data.poang === 'number') fartVisa(r.data);
      else fartFel(r.data.error || 'Googles mätning svarade inte just nu.');
    }, function () { fartFel('Googles mätning gick inte att nå just nu.'); });
  }

  var EXEMPEL = { url: 'https://exempel.se/', host: 'exempel.se', ms: 1240, passed: 5, total: 9, checks: [
    { id: 'https', label: 'Säker anslutning (https)', ok: true, detail: 'Sidan visas över https.' },
    { id: 'svarstid', label: 'Servern svarar snabbt', ok: false, detail: 'Servern svarade på 1,24 s. Googles gräns för bra är 0,8 s.' },
    { id: 'titel', label: 'Sidtitel', ok: true, detail: '”Exempel AB – frisör i Norrköping”' },
    { id: 'beskrivning', label: 'Beskrivning för sökresultat', ok: false, detail: 'Saknas. Då väljer Google själv vilken text som visas under rubriken.' },
    { id: 'mobil', label: 'Anpassad för mobil', ok: true, detail: 'Sidan anger att den ska anpassas till skärmen.' },
    { id: 'schema', label: 'Fakta som maskiner kan läsa (schema.org)', ok: false, detail: 'Saknas. Öppettider, adress och tjänster står bara som vanlig text.' },
    { id: 'ai', label: 'Släpper in AI-tjänster', ok: true, detail: 'Ingen robots.txt hittades, så inget är spärrat där.' },
    { id: 'llms', label: 'llms.txt', ok: false, detail: 'Saknas. Det är en kort textfil som beskriver företaget för AI-tjänster.' },
    { id: 'sitemap', label: 'Sajtkarta', ok: true, detail: 'Sökmotorerna får en lista över sidorna.' } ] };

  function visaFel(msg) { fel.textContent = msg; fel.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); }
  var kor = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (kor) return;
    fel.hidden = true; input.removeAttribute('aria-invalid');
    var url = input.value.trim();
    if (!url) { visaFel('Skriv in en webbadress, till exempel dittforetag.se.'); return; }
    kor = true; knapp.textContent = 'Testar …'; knapp.setAttribute('aria-disabled', 'true');
    function klar() { kor = false; knapp.textContent = 'Testa'; knapp.removeAttribute('aria-disabled'); }
    if (DEMO) { setTimeout(function () { klar(); visa(EXEMPEL); }, 500); return; }
    post('/kollen', { url: url }).then(function (r) {
      klar();
      if (r.ok && r.data.checks) visa(r.data);
      else visaFel(r.data.error || 'Testet gick inte att köra just nu. Försök igen om en stund.');
    }, function () { klar(); visaFel('Testet gick inte att nå just nu. Kontrollera uppkopplingen och försök igen.'); });
  });
  input.addEventListener('input', function () { if (!fel.hidden) { fel.hidden = true; input.removeAttribute('aria-invalid'); } });

  /* ---------- AI-assistenten ---------- */
  var chatt = $('chatt'), logg = $('chatt-logg'), cform = $('chatt-form'), cin = $('chatt-in'), cknapp = $('chatt-knapp');
  if (!chatt) return;
  var samtal = [], svarar = false, MAX_FRAGOR = 10;

  function bubbla(vem, text) {
    var b = el('div', 'bubbla bubbla-' + vem);
    b.appendChild(el('span', 'sr-only', vem === 'du' ? 'Du: ' : 'AI-assistenten: '));
    b.appendChild(document.createTextNode(text));
    logg.appendChild(b); logg.scrollTop = logg.scrollHeight;
    return b;
  }
  function aktivera() { chatt.hidden = false; }
  if (DEMO) aktivera();
  else {
    var kolla = function () { fetch(API + '/chatt').then(function (r) { return r.json(); }).then(function (d) { if (d && d.aktiv) aktivera(); }).catch(function () {}); };
    if (document.readyState === 'complete') setTimeout(kolla, 800); else addEventListener('load', function () { setTimeout(kolla, 800); }, { once: true });
  }

  cform.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = cin.value.trim();
    if (!text || svarar) return;
    if (samtal.filter(function (m) { return m.role === 'user'; }).length >= MAX_FRAGOR) { bubbla('ai', 'Nu har vi pratat en stund. Ring 070-051 00 86 eller mejla hej@nollkomma.se, så tar Sebastian det därifrån.'); return; }
    bubbla('du', text); cin.value = '';
    samtal.push({ role: 'user', content: text });
    svarar = true; cknapp.setAttribute('aria-disabled', 'true');
    var vantar = bubbla('ai', 'Skriver …'); vantar.classList.add('bubbla-vantar');
    function klar(svar, ok) {
      svarar = false; cknapp.removeAttribute('aria-disabled');
      logg.removeChild(vantar);
      bubbla('ai', svar);
      if (ok) samtal.push({ role: 'assistant', content: svar }); else samtal.pop();
    }
    if (DEMO) { setTimeout(function () { klar('Exempelsvar: i förhandsvisningen är AI-assistenten inte inkopplad. På den riktiga sajten svarar den på frågor om Nollkomma och om ditt testresultat.', true); }, 600); return; }
    post('/chatt', { messages: samtal, koll: senaste }).then(function (r) {
      if (r.ok && r.data.svar) klar(r.data.svar, true);
      else klar(r.data.error || 'Det gick inte att få svar just nu. Ring 070-051 00 86 eller mejla hej@nollkomma.se.', false);
    }, function () { klar('Det gick inte att nå AI-assistenten. Ring 070-051 00 86 eller mejla hej@nollkomma.se.', false); });
  });
})();
