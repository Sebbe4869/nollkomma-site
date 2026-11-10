// POST /api/fart  { "url": "https://dittforetag.se/" }
// Frågar Googles PageSpeed Insights hur snabb sidan är på mobil. Tar ofta 10–30 sekunder.
// PSI_API_KEY (valfri) höjer kvoten: https://developers.google.com/speed/docs/insights/v5/get-started
import { normalizeUrl } from '../../lib/kollen.js';
import { json, sameOrigin, readJson, fetchWithTimeout } from '../../lib/http.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Testet går bara att köra från nollkomma.se.' }, 403);
  const body = await readJson(request, 2000);
  let target;
  try { target = normalizeUrl(body && body.url); } catch (e) { return json({ error: e.message }, 400); }

  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  api.searchParams.set('url', target.href);
  api.searchParams.set('strategy', 'mobile');
  api.searchParams.set('category', 'performance');
  if (env && env.PSI_API_KEY) api.searchParams.set('key', env.PSI_API_KEY);

  let data;
  try {
    const res = await fetchWithTimeout(api.href, {}, 55000);
    if (!res.ok) {
      // 429 = Googles kvot är slut. Utan PSI_API_KEY delas kvoten med alla andra som anropar från samma nät.
      console.log('fart: Google svarade', res.status, env && env.PSI_API_KEY ? '(med nyckel)' : '(utan nyckel)');
      return json({ error: 'Googles mätning svarade inte just nu.', googleStatus: res.status }, 502);
    }
    data = await res.json();
  } catch (e) { return json({ error: 'Googles mätning tog för lång tid.' }, 504); }

  const lh = data && data.lighthouseResult;
  const score = lh && lh.categories && lh.categories.performance && lh.categories.performance.score;
  if (typeof score !== 'number') return json({ error: 'Google kunde inte mäta sidan.' }, 502);
  const num = id => { const a = lh.audits && lh.audits[id]; return a && typeof a.numericValue === 'number' ? a.numericValue : null; };
  return json({
    poang: Math.round(score * 100),
    lcpMs: num('largest-contentful-paint'),
    fcpMs: num('first-contentful-paint'),
    tbtMs: num('total-blocking-time'),
    cls: num('cumulative-layout-shift'),
  });
}

export const onRequest = () => json({ error: 'Använd POST.' }, 405);
