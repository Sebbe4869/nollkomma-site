// Snabbkontroll av den byggda sajten: node tools/check.js http://127.0.0.1:8090 <ut-mapp>
// Skärmdumpar (mobil + dator), sidled-scroll, laddtidspanelen, filmknappen och en axe-tillgänglighetskontroll.
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8090';
const OUT = process.argv[3] || path.join(__dirname, '..', 'checks');
const AXE = process.env.AXE_PATH; // sökväg till axe.min.js
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const results = {};
  for (const [name, opts] of [['mobil', { ...devices['iPhone 13'], deviceScaleFactor: 1 }], ['dator', { viewport: { width: 1440, height: 900 } }]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const failed = [];
    page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      laddtid: document.getElementById('laddtid').textContent,
      font: document.fonts.check('700 40px "Familjen Grotesk"'),
      h1: document.querySelectorAll('h1').length,
      jsonld: (() => { try { JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent); return 'ok'; } catch (e) { return e.message; } })(),
    }));
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 80, fullPage: true });
    if (AXE) {
      await page.addScriptTag({ path: AXE });
      r.axe = await page.evaluate(async () => {
        const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
        return res.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.length} st – ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
      });
    }
    // filmknappen: byts den mot en video som pekar på filen?
    await page.click('#film-play');
    await page.waitForTimeout(400);
    r.film = await page.evaluate(() => { const v = document.querySelector('.film-frame video'); return v ? { src: v.currentSrc || v.src, controls: v.controls, muted: v.muted } : null; });
    r.errors = errors; r.failed = failed;
    results[name] = r;
    await ctx.close();
  }
  // filen själv svarar?
  const ctx = await browser.newContext();
  const resp = await ctx.request.get(BASE + '/assets/film/nollkomma-30s-v1.mp4');
  results.filmfil = { status: resp.status(), type: resp.headers()['content-type'], bytes: (await resp.body()).length };
  for (const f of ['robots.txt', 'llms.txt', 'sitemap.xml', 'integritet.html', '404.html']) results[f] = (await ctx.request.get(BASE + '/' + f)).status();
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
