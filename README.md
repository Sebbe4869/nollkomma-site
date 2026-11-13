# Nollkomma – webbplatsen

Statisk sajt för nollkomma.se med tre små API-funktioner: sajttestet, Googles mätning och AI-assistenten.

- `dist/` är den färdigbyggda sajten.
- `functions/` är API-funktionerna (Cloudflare Pages Functions). De ligger utanför `dist/` med flit; så vill Cloudflare ha det.
- `lib/` är logiken som funktionerna delar.

## Publicera med Cloudflare

Repot fungerar på två sätt, med samma kod:

- **Workers** (det dashboarden föreslår när man importerar ett repo): lämna Build command tomt och behåll Deploy command `npx wrangler deploy`. Inställningarna står i `wrangler.jsonc`, och `worker.js` skickar `/api/*` till funktionerna och allt annat till `dist/`. Projektnamnet i Cloudflare ska vara `nollkomma-site`, samma som `name` i `wrangler.jsonc`.
- **Pages**: stegen nedan.

Variabler, spärregel, AI-inställningar, statistik och e-post (punkt 4–7 nedan) gäller i båda fallen.

### Med Pages

Sajttestet och chatten fungerar bara när sajten publiceras från ett Git-repo (eller med `wrangler pages deploy`). Att dra in en zip-fil i Cloudflare publicerar sidorna men inte funktionerna.

1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → välj det här repot.
2. Ramverk: inget. Byggkommando: lämna tomt. Build output directory: `dist`.
3. Custom domains: `nollkomma.se` och `www.nollkomma.se`.
4. Settings → Variables and Secrets (Production):

   | Namn | Typ | Behövs? | Vad den gör |
   |---|---|---|---|
   | `ANTHROPIC_API_KEY` | Secret | För chatten | Slår på AI-assistenten. Utan den syns chatten inte. Skapas i Claude Console (platform.claude.com → API keys). Sätt en månadsgräns under Billing → Spend limits. |
   | `PSI_API_KEY` | Secret | För Googles mätning | Utan nyckel svarar Google 429 (kvoten slut) från Cloudflares nät, så raden "Googles mätning på mobil" blir tom. Skapas i Google Cloud Console för PageSpeed Insights API. |
   | `CHAT_MODEL` | Text | Valfri | Byter modell. Standard är `claude-haiku-5-5`. |
   | `CHAT_AV` | Text | Valfri | Värdet `1` stänger av chatten utan att ta bort nyckeln. |

5. Security → WAF → Rate limiting rules: adresser som börjar med `/api/`, högst 10 anrop per 10 sekunder och IP-adress, åtgärd Block.
6. Security → Bots: tillåt AI-crawlers (Search, Agent och Training). Annars kan Cloudflare blockera dem trots `robots.txt`.
7. Slå på Web Analytics och Email Routing (`hej@nollkomma.se` → din vanliga e-post). Cloudflare lägger inte in statistikskriptet själv på sidor från en Worker, så `tools/build.py` lägger in det (token i `BEACON`).

Varje push till `main` publiceras automatiskt. Lägg aldrig en nyckel i en fil i repot.

## API-funktionerna

| Adress | Vad den gör |
|---|---|
| `POST /api/kollen` `{ "url": "…" }` | Hämtar sidan, robots.txt, llms.txt och sitemap.xml och svarar med nio kontroller. |
| `POST /api/fart` `{ "url": "…" }` | Frågar Googles PageSpeed Insights om mobilpoäng och laddtid. Tar 10–30 sekunder. |
| `GET /api/chatt` | Svarar `{ "aktiv": true }` när chatten är påslagen. |
| `POST /api/chatt` `{ "messages": […], "koll": {…} }` | Skickar samtalet till Claude API och svarar `{ "svar": "…" }`. |

Alla tar bara emot anrop från sajtens egna sidor, sparar ingenting och har gränser för längd och antal meddelanden. Assistentens fakta och regler står i `lib/chatt.js`. Ändrar du ett pris på sajten ska det ändras där också; ett test säger till om de går isär.

## Ändra sajten

| Vad | Var |
|---|---|
| Sidor | `src/index.html`, `src/integritet.html`, `src/404.html` |
| Gemensam CSS | `src/base.css` (läggs in i varje sida vid bygget) |
| Sajttestets och chattens gränssnitt | `static/assets/app.js` |
| Texter för sökmotorer och AI | `src/robots.txt`, `src/llms.txt`, `src/sitemap.xml`, JSON-LD i `src/index.html` |
| Säkerhets- och cacheregler | `src/_headers` |
| Bilder, typsnitt, film | `static/` |

```bash
python3 tools/build.py                         # skriver dist/ (och preview/ för förhandsvisningen i Claude)
node --test tools/test-functions.mjs           # 15 tester av funktionerna, med påhittade nätverkssvar
npx wrangler pages dev dist --port 8788 -b ANTHROPIC_API_KEY=lokal-test    # kör sajten och funktionerna lokalt
node tools/check.js http://127.0.0.1:8788      # skärmdumpar, sidled-scroll, filmknappen (AXE_PATH=… för axe)
node tools/check-ui.js http://127.0.0.1:8788   # 40 kontroller av sajttestet och chatten i mobil och dator
```

Typsnittet har en reservfont ("FG Fallback" i `src/base.css`, Arial med justerade mått) så att texten inte flyttar sig när det riktiga typsnittet laddats; utan den gav Googles mätning layoutskift 0,12 på långsamt 4G.

Uppmätt lokalt 10 november 2026: Lighthouse 100/100/100/100 i mobil och dator, 66 kB, det största innehållet syns efter 1,1 s på simulerat långsamt 4G och 0,3 s på dator.

Provat på den publicerade sajten 10 november 2026: sidorna, 404-sidan, säkerhetsreglerna, filmen och sajttestet mot en riktig sajt och mot sig själv. Provat 11 november 2026 på nollkomma.se: www och https-omdirigering, e-postposterna, AI-assistenten med nyckel, Googles mätning med nyckel (100/100 på mobil, LCP 1,5 s) och spärregeln (anrop 11–15 inom 10 s får 429).

## Filmerna

Källkoden ligger i `film/src`. Laddtiden som visas är en parameter:

```bash
MEAS=0,4 sh film/build.sh           # alla fyra filmerna i 9:16 och 4:5 → film/out/
MEAS=0,4 sh film/build.sh fart ai   # bara vissa: full, fart, ai, pris
MEAS=0,4 sh film/ljud.sh            # byter bara ljudet på färdiga filmer; GAIN_DB=… ändrar nivån
```

Ljudspåret byggs i kod av `film/sound.py` (ljudeffekter som följer bilden och en musikmatta), så det finns inga licenser att hålla reda på. Klippställena i `film/src/cuts.json` delas av bild och ljud.

Byt `MEAS` mot den uppmätta laddtiden från den riktiga sajten innan filmerna publiceras. Kopiera sedan `nollkomma-30s-4x5.mp4` till `static/assets/film/` med nytt versionsnummer i filnamnet och uppdatera sökvägen i `src/index.html`.

## Marknadsmaterialet

```bash
node tools/make_marketing.js <mapp>   # profilbild, omslag, fem inläggsbilder och säljbladet som PDF
```

## Kvar innan lansering

- [x] Köp nollkomma.se (svensk domänleverantör; Cloudflare säljer inte .se)
- [x] Cloudflare enligt listan ovan
- [x] Mät laddtiden på den riktiga sajten (0,2–0,3 s; filmernas 0,4 s står sig)
- [x] Prova sajttestet, Googles mätning, chatten och filmen på den riktiga sajten
- [ ] Foto till kontaktdelen
- [ ] Ett kundcase med tillstånd (före/efter)
