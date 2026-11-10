// Gemensamma hjälpfunktioner för API-funktionerna.

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

/** Släpper bara igenom anrop från sajtens egna sidor (webbläsaren skickar Origin vid POST). */
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host === new URL(request.url).host; } catch (e) { return false; }
}

/** Läser JSON från anropet, högst maxBytes. Returnerar null om det inte går. */
export async function readJson(request, maxBytes = 20000) {
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    const data = JSON.parse(text);
    return data && typeof data === 'object' ? data : null;
  } catch (e) { return null; }
}

/** fetch med tidsgräns. */
export async function fetchWithTimeout(url, options = {}, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...options, signal: ctrl.signal }); } finally { clearTimeout(timer); }
}
