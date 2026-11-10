// Ritar marknadsmaterialet: profilbild, omslag, inläggsbilder och säljbladet (PDF).
//   node tools/make_marketing.js <ut-mapp>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'marknad'));
fs.mkdirSync(OUT, { recursive: true });
const FONTS = path.join(ROOT, 'static/assets/fonts');
const face = w => `@font-face{font-family:FG;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(FONTS, `familjen-grotesk-latin-${w}-normal.woff2`)).toString('base64')}) format('woff2');font-weight:${w}}`;
const CSS = [400, 600, 700].map(face).join('') + `
html,body{margin:0}*{box-sizing:border-box}
:root{--kalk:#EDF0EC;--svart:#15201E;--strom:#0B5A55;--tint:#D3E4E0;--t2:#33413E;--t3:#4A5754;--varn:#A8401F}
.c{font-family:FG,Arial,sans-serif;color:var(--svart);position:relative;overflow:hidden;-webkit-font-smoothing:antialiased}
.g{background:var(--strom);color:#fff}.k{background:var(--kalk)}.n{background:var(--svart);color:#fff}
.badge{display:grid;place-items:center;border-radius:22%;font-weight:700;letter-spacing:-.04em;line-height:1;padding-bottom:.06em}
.wm{position:absolute;font-weight:700;letter-spacing:-.06em;line-height:.8;white-space:nowrap}
.h{font-weight:700;letter-spacing:-.035em;line-height:.98;margin:0}
.brand{display:flex;align-items:center;gap:.45em;font-weight:700;letter-spacing:-.01em}
.ok{display:inline-grid;place-items:center;border-radius:50%;flex:none}
`;
const check = (size, bg = '#0B5A55', fg = '#fff') => `<span class="ok" style="width:${size}px;height:${size}px;background:${bg}"><svg viewBox="0 0 24 24" width="${size * 0.62}" height="${size * 0.62}"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="${fg}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
const cross = size => `<span class="ok" style="width:${size}px;height:${size}px;background:#A8401F"><svg viewBox="0 0 24 24" width="${size * 0.62}" height="${size * 0.62}"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></svg></span>`;
const brand = (size, dark) => `<div class="brand" style="font-size:${size}px"><span class="badge" style="width:${size * 1.5}px;height:${size * 1.5}px;font-size:${size * 0.9}px;background:${dark ? '#fff' : '#0B5A55'};color:${dark ? '#0B5A55' : '#fff'}">0,</span>Nollkomma</div>`;
const foot = (dark, text = 'nollkomma.se') => `<div style="position:absolute;left:84px;right:84px;bottom:76px;display:flex;justify-content:space-between;align-items:center">${brand(40, dark)}<div style="font-weight:600;font-size:38px">${text}</div></div>`;

// Innehållet centreras i höjdled i ytan ovanför sidfoten. Vattenstämpeln (.wm) ligger kvar mot hela bilden.
const post = (cls, inner, dark) => {
  const wm = (inner.match(/<div class="wm"[^>]*>[^<]*<\/div>/) || [''])[0];
  return `<div class="c ${cls}" style="width:1080px;height:1350px">${wm}<div style="position:absolute;left:84px;right:84px;top:90px;bottom:200px;display:flex;flex-direction:column;justify-content:center">${inner.replace(wm, '')}</div>${foot(dark)}</div>`;
};

const PAGES = {
  'profilbild.png': { w: 1080, h: 1080, html: `<div class="c g" style="width:1080px;height:1080px;display:grid;place-items:center"><div style="font-weight:700;font-size:560px;letter-spacing:-.05em;line-height:1;padding-bottom:70px">0,</div></div>` },

  'omslag-linkedin-foretagssida.png': { w: 1128, h: 191, scale: 2, html: `<div class="c g" style="width:1128px;height:191px"><div class="wm" style="right:-6px;bottom:-70px;font-size:330px;color:rgba(255,255,255,.08)">0,</div>
    <div style="position:absolute;left:330px;top:0;bottom:0;right:40px;display:flex;align-items:center;justify-content:space-between;gap:30px">
      <div class="h" style="font-size:44px">Snabba hemsidor för småföretag.</div><div style="font-weight:600;font-size:26px;white-space:nowrap">nollkomma.se</div></div></div>` },

  'omslag-linkedin-egen-profil.png': { w: 1584, h: 396, html: `<div class="c g" style="width:1584px;height:396px"><div class="wm" style="right:20px;bottom:-150px;font-size:640px;color:rgba(255,255,255,.08)">0,</div>
    <div style="position:absolute;left:520px;top:0;bottom:0;right:80px;display:flex;flex-direction:column;justify-content:center;gap:18px">
      <div class="h" style="font-size:76px">Snabba hemsidor<br>för småföretag.</div><div style="font-weight:600;font-size:34px;opacity:.9">Testa din sajt gratis på nollkomma.se</div></div></div>` },

  'omslag-facebook.png': { w: 1640, h: 624, html: `<div class="c g" style="width:1640px;height:624px"><div class="wm" style="right:40px;bottom:-240px;font-size:1000px;color:rgba(255,255,255,.08)">0,</div>
    <div style="position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center">
      ${brand(46, true)}<div class="h" style="font-size:92px">Snabba hemsidor för småföretag.</div><div style="font-weight:600;font-size:38px;opacity:.9">Testa din sajt gratis på nollkomma.se</div></div></div>` },

  'bild-lansering.png': { w: 1080, h: 1350, html: post('g', `<div class="wm" style="right:-60px;bottom:120px;font-size:900px;color:rgba(255,255,255,.07)">0,</div>
    <div class="h" style="font-size:160px">Nu finns<br>Nollkomma.</div>
    <div style="font-size:54px;line-height:1.2;margin-top:44px;max-width:860px;font-weight:600">Snabba hemsidor för småföretag, skötta varje månad.</div>
    <div style="font-size:42px;margin-top:36px;opacity:.9">Från 595 kr/mån exkl. moms.</div>`, true) },

  'bild-testa.png': { w: 1080, h: 1350, html: post('k', `<div class="h" style="font-size:132px">Hur snabb är din sajt?</div>
    <div style="font-size:46px;line-height:1.25;margin-top:32px;color:var(--t2)">Testa gratis. Nio kontroller på några sekunder.</div>
    <div style="margin-top:56px;display:flex;gap:16px"><div style="flex:1;height:112px;border-radius:56px;border:4px solid var(--svart);background:#fff;display:flex;align-items:center;padding:0 44px;font-size:46px;color:var(--t3)">dittforetag.se</div><div style="height:112px;border-radius:56px;background:var(--strom);color:#fff;display:flex;align-items:center;padding:0 52px;font-size:46px;font-weight:600">Testa</div></div>
    <div style="margin-top:44px;background:#fff;border-radius:36px;padding:40px 44px;display:grid;gap:26px;font-size:42px;font-weight:600">
      <div style="display:flex;gap:22px;align-items:center">${check(52)}Säker anslutning</div>
      <div style="display:flex;gap:22px;align-items:center">${cross(52)}Släpper in AI-tjänster</div>
      <div style="display:flex;gap:22px;align-items:center">${cross(52)}Googles mätning på mobil</div></div>`, false) },

  'bild-ai.png': { w: 1080, h: 1350, html: post('n', `<div class="h" style="font-size:330px;color:#9FD3C9;letter-spacing:-.05em">62&nbsp;%</div>
    <div class="h" style="font-size:78px;line-height:1.04;margin-top:28px">av svenskarna använder <span style="white-space:nowrap">AI-tjänster.</span></div>
    <div style="font-size:50px;line-height:1.22;margin-top:40px;color:#C9D6D2">Vad svarar de när någon frågar efter ett företag som ditt?</div>
    <div style="font-size:30px;margin-top:36px;color:#9FB3AE">Källa: Svenskarna och internet 2026</div>`, true) },

  'bild-priser.png': { w: 1080, h: 1350, html: post('k', `<div class="h" style="font-size:132px">Öppna priser.</div>
    <div style="font-size:44px;margin-top:26px;color:var(--t2)">Per månad, exklusive moms.</div>
    <div style="margin-top:48px;display:grid;gap:24px">
      <div style="background:#fff;border-radius:36px;padding:38px 44px"><div style="font-size:46px;font-weight:700">Drift</div><div style="font-size:112px;font-weight:700;letter-spacing:-.04em;line-height:1.05">595 kr</div><div style="font-size:36px;color:var(--t2)">En snabb sajt som någon sköter.</div></div>
      <div style="background:#fff;border-radius:36px;padding:38px 44px"><div style="font-size:46px;font-weight:700;color:var(--strom)">Synlighet</div><div style="font-size:112px;font-weight:700;letter-spacing:-.04em;line-height:1.05">1&nbsp;195 kr</div><div style="font-size:36px;color:var(--t2)">Plus Google-profil, lokal sökoptimering och AI-koll.</div></div></div>
    <div style="font-size:36px;margin-top:30px;color:var(--t2)">Ny sajt från 4&nbsp;900 kr.</div>`, false) },

  'bild-nio.png': { w: 1080, h: 1350, html: post('g', `<div class="h" style="font-size:104px">Nio saker testet kollar</div>
    <div style="margin-top:50px;display:grid;gap:21px;font-size:44px;font-weight:600">${['Säker anslutning (https)', 'Hur snabbt servern svarar', 'Sidtitel', 'Beskrivning för sökresultat', 'Anpassad för mobil', 'Fakta som maskiner kan läsa', 'Släpper in AI-tjänster', 'llms.txt', 'Sajtkarta'].map(t => `<div style="display:flex;gap:22px;align-items:center">${check(50, '#fff', '#0B5A55')}${t}</div>`).join('')}</div>
    <div style="font-size:38px;margin-top:40px;opacity:.9">Plus Googles mätning på mobil. Gratis.</div>`, true) },
};

const SALJBLAD = `<div class="c k" style="width:210mm;height:297mm;padding:17mm 17mm 14mm;display:flex;flex-direction:column">
  <div style="display:flex;justify-content:space-between;align-items:center">${brand(19, false)}<div style="font-size:11pt;color:var(--t2)">nollkomma.se</div></div>
  <div class="h" style="font-size:40pt;margin-top:12mm;max-width:150mm">Snabba hemsidor för småföretag.</div>
  <p style="font-size:13pt;line-height:1.45;color:var(--t2);margin:6mm 0 0;max-width:150mm">Jag bygger och sköter din sajt och ser till att den syns i Google och i AI-tjänster. Fast pris varje månad, och du äger ditt innehåll och din domän.</p>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm;margin-top:9mm">
    ${[['Snabb', 'Sidor som laddar på nolltid. Laddtiden mäts och redovisas, den utlovas inte bara.'], ['Synlig', 'Byggd så att Google och AI-tjänster kan läsa dina öppettider, priser och var du finns.'], ['Skött', 'Drift, säkerhetskopior, ändringar och en rapport varje månad. Svar inom två arbetsdagar.']].map(([a, b]) => `<div style="border-top:1.2mm solid var(--svart);padding-top:3.5mm"><div style="font-size:15pt;font-weight:700">${a}</div><div style="font-size:10.5pt;line-height:1.45;color:var(--t2);margin-top:1.5mm">${b}</div></div>`).join('')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:9mm">
    <div style="background:#fff;border-radius:5mm;padding:6mm">
      <div style="font-size:15pt;font-weight:700">Drift</div>
      <div style="font-size:30pt;font-weight:700;letter-spacing:-.04em;line-height:1.1">595 <span style="font-size:13pt;font-weight:400;letter-spacing:0;color:var(--t2)">kr/mån</span></div>
      <ul style="margin:3mm 0 0;padding:0;list-style:none;display:grid;gap:2mm;font-size:10.5pt;line-height:1.35">${['Drift, säker anslutning och säkerhetskopior', 'Övervakning av att sajten är uppe', 'En domän, med förnyelse', 'Ändringar 30 minuter per månad', 'Månadsrapport om besök och drift', 'Svar inom två arbetsdagar'].map(t => `<li style="display:flex;gap:2.5mm;align-items:flex-start">${check(15)}<span>${t}</span></li>`).join('')}</ul>
    </div>
    <div style="background:#fff;border-radius:5mm;padding:6mm">
      <div style="font-size:15pt;font-weight:700;color:var(--strom)">Synlighet</div>
      <div style="font-size:30pt;font-weight:700;letter-spacing:-.04em;line-height:1.1">1&nbsp;195 <span style="font-size:13pt;font-weight:400;letter-spacing:0;color:var(--t2)">kr/mån</span></div>
      <ul style="margin:3mm 0 0;padding:0;list-style:none;display:grid;gap:2mm;font-size:10.5pt;line-height:1.35">${['Allt i Drift', 'Google-företagsprofil: inlägg och svar på recensioner', 'Lokal sökoptimering varje månad', 'Koll på hur AI-tjänster beskriver dig, varje kvartal', 'Ändringar 60 minuter per månad'].map(t => `<li style="display:flex;gap:2.5mm;align-items:flex-start">${check(15)}<span>${t}</span></li>`).join('')}</ul>
    </div>
  </div>
  <p style="font-size:10pt;line-height:1.45;color:var(--t3);margin:4mm 0 0">Priserna är exklusive moms. Ny sajt från 4&nbsp;900 kr. Arbete utöver paketet kostar 750 kr i timmen och görs alltid efter ditt godkännande. Uppsägningstiden är tre månader. Bygger jag en ny sajt åt dig gäller avtalet i minst tolv månader.</p>

  <div style="margin-top:auto;background:var(--strom);color:#fff;border-radius:5mm;padding:7mm;display:grid;grid-template-columns:1.25fr 1fr;gap:8mm;align-items:center">
    <div><div style="font-size:19pt;font-weight:700;letter-spacing:-.02em;line-height:1.1">Testa din sajt gratis på nollkomma.se</div><div style="font-size:11pt;line-height:1.45;margin-top:2mm;opacity:.92">Nio kontroller på några sekunder: fart, Google och AI-tjänster.</div></div>
    <div style="font-size:11.5pt;line-height:1.6"><div style="font-weight:700;font-size:13pt">Boka 15 minuter</div><div>Sebastian, Nollkomma</div><div>070-051 00 86</div><div>hej@nollkomma.se</div></div>
  </div>
  <div style="font-size:9pt;color:var(--t3);margin-top:4mm">Nollkomma · Enskild firma, godkänd för F-skatt · Norrköping · På plats i Östergötland, på distans i hela Sverige</div>
</div>`;

(async () => {
  const browser = await chromium.launch();
  for (const [name, p] of Object.entries(PAGES)) {
    const page = await browser.newPage({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: p.scale || 1 });
    await page.setContent(`<style>${CSS}</style>${p.html}`);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => { const c = document.querySelector('.c'); return [...c.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(), b = c.getBoundingClientRect(); return !e.classList.contains('wm') && r.width > 0 && (r.right > b.right + 1 || r.bottom > b.bottom + 1 || r.left < b.left - 1); }).length; });
    await page.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: 0, width: p.w, height: p.h } });
    console.log(name, overflow ? `(!) ${overflow} element utanför bilden` : 'ok');
    await page.close();
  }
  const page = await browser.newPage();
  await page.setContent(`<style>${CSS}@page{size:A4;margin:0}</style>${SALJBLAD}`);
  await page.evaluate(() => document.fonts.ready);
  const fits = await page.evaluate(() => { const c = document.querySelector('.c'); return c.scrollHeight <= c.clientHeight + 1; });
  await page.pdf({ path: path.join(OUT, 'saljblad-nollkomma.pdf'), format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.screenshot({ path: path.join(OUT, '_saljblad-koll.png') });
  console.log('saljblad-nollkomma.pdf', fits ? 'ok' : '(!) innehållet får inte plats på en sida');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
