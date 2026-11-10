// POST /api/kollen  { "url": "dittforetag.se" }
// Hämtar sidan, robots.txt, llms.txt och sitemap.xml och svarar med nio kontroller. Sparar ingenting.
import { normalizeUrl, buildChecks, UA } from '../../lib/kollen.js';
import { json, sameOrigin, readJson, fetchWithTimeout } from '../../lib/http.js';

const headers = { 'user-agent': UA, accept: 'text/html,text/plain;q=0.9,*/*;q=0.5', 'accept-language': 'sv,en;q=0.5' };

async function getText(get, url, maxChars) {
  try {
    const res = await get(url);
    const type = res.headers.get('content-type') || '';
    const text = res.ok ? (await res.text()).slice(0, maxChars) : '';
    return { ok: res.ok, status: res.status, type, text };
  } catch (e) { return { ok: false, status: 0, type: '', text: '' }; }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Testet går bara att köra från nollkomma.se.' }, 403);
  const body = await readJson(request, 2000);
  let target;
  try { target = normalizeUrl(body && body.url); } catch (e) { return json({ error: e.message }, 400); }

  // En Worker kan inte hämta sin egen adress över nätet (Cloudflare svarar 404). Testas den egna sajten
  // läses sidorna därför direkt ur de publicerade filerna.
  const ownHost = new URL(request.url).host;
  const get = url => (new URL(url).host === ownHost && env && env.ASSETS)
    ? env.ASSETS.fetch(new Request(url, { headers }))
    : fetchWithTimeout(url, { headers, redirect: 'follow' });

  const started = Date.now();
  let res;
  try { res = await get(target.href); }
  catch (e) { return json({ error: 'Sidan svarade inte inom åtta sekunder. Kontrollera adressen och försök igen.' }, 422); }
  const ms = Date.now() - started;
  if (!res.ok) return json({ error: 'Sidan svarade med felkod ' + res.status + '. Kontrollera adressen och försök igen.' }, 422);
  const type = res.headers.get('content-type') || '';
  if (!/html/i.test(type)) return json({ error: 'Adressen leder inte till en webbsida.' }, 422);
  const html = (await res.text()).slice(0, 300000);
  const finalUrl = res.url || target.href;
  const origin = new URL(finalUrl).origin;

  const [robots, llms, sitemap] = await Promise.all([
    getText(get, origin + '/robots.txt', 50000),
    getText(get, origin + '/llms.txt', 2000),
    getText(get, origin + '/sitemap.xml', 2000),
  ]);
  const isText = r => r.ok && !/html/i.test(r.type) && !/^\s*</.test(r.text);
  const robotsFound = isText(robots);
  const sitemapInRobots = robotsFound && /^\s*sitemap\s*:/im.test(robots.text);

  const result = buildChecks({
    finalUrl, ms, html, self: new URL(finalUrl).host === ownHost,
    robots: { found: robotsFound, text: robots.text },
    llms: { found: isText(llms) && llms.text.trim().length > 20 },
    sitemap: { found: sitemapInRobots || (sitemap.ok && /<(urlset|sitemapindex)\b/i.test(sitemap.text)) },
  });
  return json({ url: finalUrl, host: new URL(finalUrl).hostname, ms, ...result });
}

export const onRequest = () => json({ error: 'Använd POST.' }, 405);
