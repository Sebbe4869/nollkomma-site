// Logiken bakom "Testa din sajt". Ren JavaScript utan beroenden, så att den går att testa i Node.

export const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended'];
export const UA = 'NollkommaSajtkoll/1.0 (+https://nollkomma.se/#test)';

/** Gör om det besökaren skrev till en säker https-adress, eller kastar ett fel med svensk text. */
export function normalizeUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new Error('Skriv in en webbadress, till exempel dittforetag.se.');
  if (raw.length > 200) throw new Error('Adressen är för lång.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
  let u;
  try { u = new URL(raw); } catch (e) { throw new Error('Det där ser inte ut som en webbadress. Prova till exempel dittforetag.se.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Adressen måste börja med http eller https.');
  const host = u.hostname.toLowerCase();
  const okHost = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9-]{2,})$/.test(host);
  const internal = /(^|\.)(localhost|local|internal|lan|home|corp|test|invalid|example)$/.test(host);
  if (!okHost || internal || u.port || u.username || u.password) throw new Error('Den adressen går inte att testa. Prova sajtens vanliga adress, till exempel dittforetag.se.');
  u.hash = '';
  return u;
}

/** Vilka av AI-tjänsternas robotar som robots.txt stänger ute från hela sajten. */
export function blockedBots(robotsTxt, bots = AI_BOTS) {
  const groups = [];
  let current = null, lastWasAgent = false;
  for (const line of String(robotsTxt || '').split(/\r?\n/)) {
    const clean = line.replace(/#.*$/, '').trim();
    const m = clean.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), value = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && current) {
      current.rules.push([key, value]);
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const blocksAll = rules => {
    const dis = rules.some(([k, v]) => k === 'disallow' && (v === '/' || v === '/*'));
    const allow = rules.some(([k, v]) => k === 'allow' && (v === '/' || v === '/*'));
    return dis && !allow;
  };
  return bots.filter(bot => {
    const own = groups.filter(g => g.agents.includes(bot.toLowerCase()));
    const use = own.length ? own : groups.filter(g => g.agents.includes('*'));
    return blocksAll(use.flatMap(g => g.rules));
  });
}

const decode = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => { const m = tag.match(new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? decode(m[1] ?? m[2] ?? m[3]) : ''; };

/** Plockar ut det som testet behöver ur sidans HTML. */
export function readHtml(html) {
  const h = String(html || '').slice(0, 300000);
  const title = decode((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  let description = '', viewport = false;
  for (const tag of h.match(/<meta\b[^>]*>/gi) || []) {
    const name = attr(tag, 'name').toLowerCase();
    if (name === 'description' && !description) description = attr(tag, 'content');
    if (name === 'viewport') viewport = true;
  }
  const types = new Set();
  const collect = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(collect);
    const t = node['@type'];
    (Array.isArray(t) ? t : t ? [t] : []).forEach(x => typeof x === 'string' && types.add(x));
    if (node['@graph']) collect(node['@graph']);
  };
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m, found = false;
  while ((m = re.exec(h))) { found = true; try { collect(JSON.parse(m[1])); } catch (e) { /* trasig JSON räknas som hittad men utan typer */ } }
  return { title, description, viewport, schema: found, schemaTypes: [...types].slice(0, 6) };
}

const short = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const sek = ms => (ms / 1000).toFixed(2).replace('.', ',') + ' s';

/** Sätter ihop de nio kontrollerna till det som visas på sidan. */
export function buildChecks({ finalUrl, ms, html, robots, llms, sitemap, self = false }) {
  const page = readHtml(html);
  const blocked = robots.found ? blockedBots(robots.text) : [];
  const checks = [
    { id: 'https', label: 'Säker anslutning (https)', ok: finalUrl.startsWith('https://'), detail: finalUrl.startsWith('https://') ? 'Sidan visas över https.' : 'Sidan visas utan https. Webbläsare varnar för det.' },
    { id: 'svarstid', label: 'Servern svarar snabbt', ok: ms <= 800, detail: self ? 'Den här sajten ligger på samma server som testet, så svaret kom direkt. Googles mätning nedan visar farten över nätet.' : 'Servern svarade på ' + sek(ms) + '. Googles gräns för bra är 0,8 s.' },
    { id: 'titel', label: 'Sidtitel', ok: !!page.title, detail: page.title ? '”' + short(page.title, 70) + '”' : 'Sidan saknar titel. Det är den som syns som rubrik i Google.' },
    { id: 'beskrivning', label: 'Beskrivning för sökresultat', ok: !!page.description, detail: page.description ? '”' + short(page.description, 110) + '”' : 'Saknas. Då väljer Google själv vilken text som visas under rubriken.' },
    { id: 'mobil', label: 'Anpassad för mobil', ok: page.viewport, detail: page.viewport ? 'Sidan anger att den ska anpassas till skärmen.' : 'Sidan saknar inställningen som anpassar den till mobilskärmar.' },
    { id: 'schema', label: 'Fakta som maskiner kan läsa (schema.org)', ok: page.schema, detail: page.schema ? (page.schemaTypes.length ? 'Hittade: ' + page.schemaTypes.join(', ') + '.' : 'Hittade strukturerad data.') : 'Saknas. Öppettider, adress och tjänster står bara som vanlig text.' },
    { id: 'ai', label: 'Släpper in AI-tjänster', ok: blocked.length === 0, detail: blocked.length ? 'robots.txt stänger ute: ' + blocked.join(', ') + '.' : robots.found ? 'robots.txt stänger inte ute någon av de stora AI-tjänsterna.' : 'Ingen robots.txt hittades, så inget är spärrat där.' },
    { id: 'llms', label: 'llms.txt', ok: llms.found, detail: llms.found ? 'Sajten har en llms.txt som beskriver företaget för AI-tjänster.' : 'Saknas. Det är en kort textfil som beskriver företaget för AI-tjänster.' },
    { id: 'sitemap', label: 'Sajtkarta', ok: sitemap.found, detail: sitemap.found ? 'Sökmotorerna får en lista över sidorna.' : 'Ingen sitemap.xml hittades.' },
  ];
  return { checks, passed: checks.filter(c => c.ok).length, total: checks.length };
}
