// Kontrollerar "Testa din sajt" och AI-assistenten i en riktig webbläsare mot den lokala sajten:
//   wrangler pages dev dist --port 8788 -b ANTHROPIC_API_KEY=lokal-test   (i ett annat fönster)
//   AXE_PATH=…/axe.min.js node tools/check-ui.js http://127.0.0.1:8788 <ut-mapp>
// Svaren från Google och Claude API är påhittade här (nätet är avstängt i testmiljön); felvägarna går mot de riktiga funktionerna.
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const OUT = process.argv[3] || path.join(__dirname, '..', 'checks');
const AXE = process.env.AXE_PATH;
fs.mkdirSync(OUT, { recursive: true });

const KOLL = { url: 'https://cafe-exempel.se/', host: 'cafe-exempel.se', ms: 412, passed: 6, total: 9, checks: [
  { id: 'https', label: 'Säker anslutning (https)', ok: true, detail: 'Sidan visas över https.' },
  { id: 'svarstid', label: 'Servern svarar snabbt', ok: true, detail: 'Servern svarade på 0,41 s. Googles gräns för bra är 0,8 s.' },
  { id: 'titel', label: 'Sidtitel', ok: true, detail: '”Café Exempel”' },
  { id: 'beskrivning', label: 'Beskrivning för sökresultat', ok: false, detail: 'Saknas.' },
  { id: 'mobil', label: 'Anpassad för mobil', ok: true, detail: 'Ja.' },
  { id: 'schema', label: 'Fakta som maskiner kan läsa (schema.org)', ok: false, detail: 'Saknas.' },
  { id: 'ai', label: 'Släpper in AI-tjänster', ok: true, detail: 'Inget spärrat.' },
  { id: 'llms', label: 'llms.txt', ok: false, detail: 'Saknas.' },
  { id: 'sitemap', label: 'Sajtkarta', ok: true, detail: 'Finns.' } ] };

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); };

(async () => {
  const browser = await chromium.launch();
  for (const [device, opts] of [['mobil', { ...devices['iPhone 13'], deviceScaleFactor: 1 }], ['dator', { viewport: { width: 1440, height: 900 } }]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    let chattBody = null, mock = false;
    await page.route('**/api/kollen', r => mock ? r.fulfill({ json: KOLL }) : r.continue());
    await page.route('**/api/fart', r => mock ? setTimeout(() => r.fulfill({ json: { poang: 58, lcpMs: 4310 } }), 400) : r.continue());
    await page.route('**/api/chatt', r => {
      if (r.request().method() !== 'POST' || !mock) return r.continue();
      chattBody = r.request().postDataJSON();
      r.fulfill({ json: { svar: 'llms.txt är en kort textfil som beskriver företaget för AI-tjänster.' } });
    });

    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForSelector('#chatt:not([hidden])', { timeout: 5000 }).catch(() => {});
    check(`${device}: chatten visas när nyckeln finns`, await page.isVisible('#chatt'));

    // tomt fält
    await page.click('#koll-knapp');
    check(`${device}: tomt fält ger felmeddelande`, (await page.textContent('#koll-fel')).includes('Skriv in en webbadress'));
    check(`${device}: fältet markeras som ogiltigt och får fokus`, await page.evaluate(() => document.activeElement.id === 'koll-url' && document.activeElement.getAttribute('aria-invalid') === 'true'));

    // riktig funktion, adress som inte får testas
    await page.fill('#koll-url', 'localhost');
    await page.click('#koll-knapp');
    await page.waitForFunction(() => !document.getElementById('koll-fel').hidden && document.getElementById('koll-fel').textContent.includes('går inte att testa'), null, { timeout: 8000 }).catch(() => {});
    check(`${device}: riktig funktion avvisar localhost`, (await page.textContent('#koll-fel')).includes('går inte att testa'), await page.textContent('#koll-fel'));
    check(`${device}: felet försvinner när man skriver`, await page.evaluate(() => { const i = document.getElementById('koll-url'); i.value = 'c'; i.dispatchEvent(new Event('input', { bubbles: true })); return document.getElementById('koll-fel').hidden; }));

    // påhittat bra svar
    mock = true;
    await page.fill('#koll-url', 'cafe-exempel.se');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#koll-ut:not([hidden]) .koll-summa');
    check(`${device}: summering visas`, (await page.textContent('.koll-summa')) === 'cafe-exempel.se: 6 av 9 klarar sig.', await page.textContent('.koll-summa'));
    check(`${device}: fokus flyttas till resultatet`, await page.evaluate(() => document.activeElement.classList.contains('koll-summa')));
    check(`${device}: väntar på Googles mätning`, await page.isVisible('.koll-vantar'));
    await page.waitForSelector('.koll-vantar', { state: 'detached', timeout: 5000 }).catch(() => {});
    const last = await page.textContent('.koll-lista li:last-child');
    check(`${device}: Googles mätning visas`, last.includes('58 av 100') && last.includes('4,3 s'), last);
    check(`${device}: tio rader, tre + mätningen underkända`, (await page.locator('.koll-lista li').count()) === 10 && (await page.locator('.koll-nej').count()) === 4);
    check(`${device}: knappen återställd`, (await page.textContent('#koll-knapp')) === 'Testa' && !(await page.getAttribute('#koll-knapp', 'aria-disabled')));

    // chatt
    await page.fill('#chatt-in', 'Vad är llms.txt?');
    await page.click('#chatt-knapp');
    await page.waitForFunction(() => document.querySelectorAll('#chatt-logg .bubbla-ai:not(.bubbla-vantar)').length >= 2, null, { timeout: 5000 }).catch(() => {});
    check(`${device}: svar från assistenten visas`, (await page.textContent('#chatt-logg')).includes('kort textfil'));
    check(`${device}: testresultatet följer med till assistenten`, chattBody && chattBody.koll && chattBody.koll.host === 'cafe-exempel.se' && chattBody.koll.poang === 58 && chattBody.messages.length === 1, JSON.stringify(chattBody && chattBody.koll && { host: chattBody.koll.host, poang: chattBody.koll.poang }));
    check(`${device}: fältet töms`, (await page.inputValue('#chatt-in')) === '');

    // riktig chattfunktion (nätet är avstängt här, så den ska svara med hänvisning till telefon)
    mock = false;
    await page.fill('#chatt-in', 'Hej igen');
    await page.click('#chatt-knapp');
    await page.waitForFunction(() => document.getElementById('chatt-logg').textContent.includes('070-051 00 86'), null, { timeout: 30000 }).catch(() => {});
    check(`${device}: fel från AI-tjänsten ger hänvisning till telefon`, (await page.textContent('#chatt-logg')).includes('070-051 00 86'));

    check(`${device}: ingen sidled-scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    if (AXE) {
      await page.addScriptTag({ path: AXE });
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map(v => `${v.id}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`));
      check(`${device}: axe utan fel`, v.length === 0, v.join('; '));
    }
    await page.locator('#test').screenshot({ path: path.join(OUT, `test-${device}.jpg`), type: 'jpeg', quality: 82 });

    // filmen under innehållspolicyn
    await page.click('#film-play');
    await page.waitForTimeout(1200);
    // Testwebbläsaren saknar H.264, så uppspelningen går inte att prova här. Det som kontrolleras är att spelaren
    // byts in med rätt fil och att innehållspolicyn inte stoppar något.
    check(`${device}: filmknappen byts mot en spelare med filmen`, await page.evaluate(() => { const v = document.querySelector('.film-frame video'); return !!v && v.controls && /nollkomma-30s-v1\.mp4|^blob:/.test(v.src); }));
    const csp = await page.evaluate(() => window.__csp);
    check(`${device}: innehållspolicyn stoppar ingenting`, csp.length === 0, csp.join(' | '));
    const real = errors.filter(e => !/Failed to load resource/.test(e)); // 400/502-svaren i testet och filmen utan H.264
    check(`${device}: inga fel i konsolen (t.ex. från innehållspolicyn)`, real.length === 0, real.join(' | '));
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter(r => !r.ok);
  for (const r of results) console.log((r.ok ? 'OK   ' : 'FEL  ') + r.name + (r.ok || !r.info ? '' : '  → ' + r.info));
  console.log(`\n${results.length - failed.length} av ${results.length} kontroller godkända`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
