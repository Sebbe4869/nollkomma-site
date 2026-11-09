// Ritar delningsbilden (og.jpg) och ikonen i Familjen Grotesk. Körs en gång: node tools/make_assets.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FONTS = path.join(ROOT, 'static/assets/fonts');
const face = w => `@font-face{font-family:FG;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(FONTS, `familjen-grotesk-latin-${w}-normal.woff2`)).toString('base64')}) format('woff2');font-weight:${w}}`;
const CSS = [400, 600, 700].map(face).join('') + 'html,body{margin:0}*{box-sizing:border-box}';

const OG = `<style>${CSS}
.c{width:1200px;height:630px;background:#0B5A55;color:#fff;font-family:FG;padding:84px 88px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.b{display:flex;align-items:center;gap:26px}
.badge{width:104px;height:104px;border-radius:26px;background:#fff;color:#0B5A55;display:grid;place-items:center;font-weight:700;font-size:68px;letter-spacing:-.04em;padding-bottom:6px}
.n{font-weight:700;font-size:96px;letter-spacing:-.04em;line-height:1}
.t{font-weight:600;font-size:52px;line-height:1.08;letter-spacing:-.02em;max-width:900px}
.p{font-size:34px;opacity:.85;margin-top:18px}
.wm{position:absolute;right:-40px;bottom:-190px;font-weight:700;font-size:620px;letter-spacing:-.06em;color:rgba(255,255,255,.07);line-height:1}
</style><div class="c"><div class="wm">0,</div><div class="b"><div class="badge">0,</div><div class="n">Nollkomma</div></div>
<div><div class="t">Snabba hemsidor för småföretag i Norrköping.</div><div class="p">Från 595 kr/mån exkl. moms · nollkomma.se</div></div></div>`;

const ICON = `<style>${CSS}.i{width:512px;height:512px;background:#0B5A55;color:#fff;font-family:FG;font-weight:700;font-size:300px;letter-spacing:-.05em;display:grid;place-items:center;padding-bottom:28px}</style><div class="i">0,</div>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.setContent(OG); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(ROOT, 'static/assets/og.jpg'), type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await p.setViewportSize({ width: 512, height: 512 });
  await p.setContent(ICON); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(ROOT, 'tools/icon-512.png'), clip: { x: 0, y: 0, width: 512, height: 512 } });
  await b.close();
  console.log('og.jpg + icon-512.png');
})().catch(e => { console.error(e); process.exit(1); });
