// node render.js <916|45> stills <t1> <t2> ...   → stills/<fmt>_<t>.jpg
// node render.js <916|45> video                   → out/<fmt>/seg*.mp4 + list.txt
// MEAS=0,4 sets the measured load time shown in the film.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const fmt = process.argv[2] || '916';
const mode = process.argv[3] || 'stills';
const MEAS = process.env.MEAS || '0,4';
const W = 1080, H = fmt === '45' ? 1350 : 1920, FPS = 30;
// Varje film är en lista av avsnitt ur tidslinjen. `under` fryser en scen under övergången, `hide` gömmer scener.
const CUTS = {
  full: [[0, 8.0], [8.0, 9.8], [9.8, 15.0], [15.0, 21.0], [21.0, 25.5], [25.5, 30.0]].map(([from, to]) => ({ from, to })),
  fart: [{ from: 0, to: 3.4 }, { from: 8.0, to: 9.8 }, { from: 9.8, to: 15.0 }, { from: 25.5, to: 30.0, under: { id: 'sC', t: 14.99 }, hide: ['sE'] }],
  ai: [{ from: 3.95, to: 8.0 }, { from: 15.0, to: 21.0, under: { id: 'sA', t: 7.99 }, hide: ['sC'] }, { from: 25.5, to: 30.0, under: { id: 'sD', t: 20.99 }, hide: ['sE'] }],
  pris: [{ from: 21.0, to: 25.5, hide: ['sD'] }, { from: 25.5, to: 30.0 }],
};
const CUT = process.env.CUT || 'full';
if (!CUTS[CUT]) { console.error('Okänd film: ' + CUT + '. Välj en av: ' + Object.keys(CUTS).join(', ')); process.exit(1); }
const SEGS = CUTS[CUT];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('[pageerror]', e.message); process.exitCode = 2; });
  await page.goto('file://' + path.join(ROOT, 'src/index.html') + `?fmt=${fmt}&n=${encodeURIComponent(MEAS)}`);
  const css = [400, 500, 600, 700].map(w => `@font-face{font-family:'FG';src:url(data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, `assets/fonts/familjen-grotesk-latin-${w}-normal.woff2`)).toString('base64')}) format('woff2');font-weight:${w};font-style:normal;font-display:block}`).join('\n');
  await page.addStyleTag({ content: css });
  await page.evaluate(async () => {
    await Promise.all([400, 500, 600, 700].map(w => document.fonts.load(`${w} 60px FG`, 'ÅÄÖåäö0,4–')));
    await document.fonts.load('400 31px "IBM Plex Mono"', 'abc');
    await document.fonts.ready;
    window.init();
  });
  const fontOk = await page.evaluate(() => [400, 500, 600, 700].every(w => document.fonts.check(`${w} 60px FG`)));
  console.log('Familjen Grotesk loaded:', fontOk);
  if (!fontOk) process.exit(3);

  if (mode === 'stills') {
    const outDir = path.join(ROOT, 'stills'); fs.mkdirSync(outDir, { recursive: true });
    for (const t of process.argv.slice(4).map(Number)) {
      // t räknas i den valda filmens egen tid
      let left = t, seg = SEGS[SEGS.length - 1];
      for (const s of SEGS) { if (left < s.to - s.from) { seg = s; break; } left -= s.to - s.from; }
      await page.evaluate(([tt, under, hide]) => window.renderCut(tt, under, hide), [seg.from + left, seg.under || null, seg.hide || []]);
      const f = path.join(outDir, `${CUT}_${fmt}_${t.toFixed(2)}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
      console.log(f);
    }
  } else {
    const outDir = CUT === 'full' ? path.join(ROOT, 'out', fmt) : path.join(ROOT, 'out', fmt, CUT); fs.mkdirSync(outDir, { recursive: true });
    const only = process.env.SEG ? process.env.SEG.split(',').map(Number) : null;
    for (let s = 0; s < SEGS.length; s++) {
      if (only && !only.includes(s)) continue;
      const seg = SEGS[s], n = Math.round((seg.to - seg.from) * FPS);
      const final = path.join(outDir, `seg${s}.mp4`), tmp = path.join(outDir, `seg${s}.tmp.mp4`);
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp],
        { stdio: ['pipe', 'inherit', 'inherit'] });
      const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
      for (let k = 0; k < n; k++) {
        await page.evaluate(([t, under, hide]) => window.renderCut(t, under, hide), [seg.from + k / FPS, seg.under || null, seg.hide || []]);
        const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      ff.stdin.end();
      await done;
      fs.renameSync(tmp, final);
      console.log(`${CUT} seg${s}: ${n} frames`);
    }
    fs.writeFileSync(path.join(outDir, 'list.txt'), SEGS.map((_, s) => `file '${path.join(outDir, `seg${s}.mp4`)}'`).join('\n') + '\n');
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
