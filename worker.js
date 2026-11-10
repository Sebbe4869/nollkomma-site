// Startpunkt när sajten körs som en Cloudflare Worker (`npx wrangler deploy`).
// Adresser under /api/ går till samma funktioner som i functions/api/; allt annat är filerna i dist/.
import * as kollen from './functions/api/kollen.js';
import * as fart from './functions/api/fart.js';
import * as chatt from './functions/api/chatt.js';

const routes = { '/api/kollen': kollen, '/api/fart': fart, '/api/chatt': chatt };

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    const mod = routes[path];
    if (mod) {
      const method = request.method[0] + request.method.slice(1).toLowerCase(); // GET → Get
      const handler = mod['onRequest' + method] || mod.onRequest;
      return handler({ request, env, ctx });
    }
    if (path.startsWith('/api/')) return new Response('{"error":"Finns inte."}', { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } });
    return env.ASSETS.fetch(request);
  },
};
