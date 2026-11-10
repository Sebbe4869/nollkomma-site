// GET  /api/chatt  → { "aktiv": true|false }  (är chatten påslagen?)
// POST /api/chatt  { "messages": [{role, content}, …], "koll": {…valfritt testresultat…} }  → { "svar": "…" }
//
// Kräver hemligheten ANTHROPIC_API_KEY i Cloudflare Pages. Utan den är chatten avstängd och syns inte på sajten.
// CHAT_MODEL (valfri) byter modell. CHAT_AV=1 stänger av chatten utan att ta bort nyckeln.
import { SYSTEM, LIMITS, DEFAULT_MODEL, cleanMessages, describeKoll } from '../../lib/chatt.js';
import { json, sameOrigin, readJson, fetchWithTimeout } from '../../lib/http.js';

const active = env => !!(env && env.ANTHROPIC_API_KEY && env.CHAT_AV !== '1');

export const onRequestGet = ({ env }) => json({ aktiv: active(env) });

export async function onRequestPost({ request, env }) {
  if (!active(env)) return json({ error: 'Chatten är inte igång just nu.' }, 503);
  if (!sameOrigin(request)) return json({ error: 'Chatten går bara att använda på nollkomma.se.' }, 403);
  const body = await readJson(request);
  if (!body) return json({ error: 'Ogiltigt anrop.' }, 400);
  const { messages, error } = cleanMessages(body.messages);
  if (error) return json({ error }, 400);

  let res;
  try {
    res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: env.CHAT_MODEL || DEFAULT_MODEL,
        max_tokens: LIMITS.maxTokens,
        system: SYSTEM + describeKoll(body.koll),
        messages,
      }),
    }, 25000);
  } catch (e) { return json({ error: 'AI-assistenten svarade inte i tid. Försök igen, eller ring 070-051 00 86.' }, 504); }

  if (!res.ok) {
    // Logga status (aldrig nyckeln) så att felet syns i Cloudflares loggar.
    console.log('chatt: Anthropic svarade', res.status);
    return json({ error: 'AI-assistenten har problem just nu. Ring 070-051 00 86 eller mejla hej@nollkomma.se.' }, 502);
  }
  const data = await res.json();
  const svar = Array.isArray(data.content) ? data.content.filter(p => p && p.type === 'text').map(p => p.text).join('').trim() : '';
  if (!svar) return json({ error: 'AI-assistenten gav inget svar. Försök igen.' }, 502);
  return json({ svar });
}

export const onRequest = () => json({ error: 'Använd GET eller POST.' }, 405);
