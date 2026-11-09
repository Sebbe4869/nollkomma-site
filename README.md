# Nollkomma – webbplatsen

Statisk sajt för nollkomma.se: snabba hemsidor för småföretag i Norrköping, på plats i Östergötland och på distans i hela Sverige.

Allt som ska ut på nätet ligger färdigbyggt i `dist/`. Ingen byggprocess behövs för att publicera.

## Publicera med Cloudflare Pages

1. Cloudflare → Workers & Pages → skapa ett Pages-projekt → koppla till Git → välj det här repot.
2. Ramverk: inget. Byggkommando: lämna tomt. Mapp att publicera (build output directory): `dist`.
3. Lägg till domänerna `nollkomma.se` och `www.nollkomma.se` under Custom domains.
4. Slå på Web Analytics (cookiefri statistik) och Email Routing (`hej@nollkomma.se` → din vanliga e-post).
5. Security → Bots: tillåt AI-crawlers (Search, Agent och Training). Annars kan Cloudflare blockera dem trots `robots.txt`.

Varje push till `main` publiceras automatiskt.

## Ändra sajten

| Vad | Var |
|---|---|
| Sidor | `src/index.html`, `src/integritet.html`, `src/404.html` |
| Gemensam CSS | `src/base.css` (läggs in i varje sida vid bygget) |
| Texter för sökmotorer och AI | `src/robots.txt`, `src/llms.txt`, `src/sitemap.xml`, JSON-LD i `src/index.html` |
| Säkerhets- och cacheregler | `src/_headers` |
| Bilder, typsnitt, film | `static/` |

Bygg om efter en ändring:

```bash
python3 tools/build.py        # skriver dist/ (och preview/ för förhandsvisningen i Claude)
```

Kontrollera:

```bash
cd dist && python3 -m http.server 8090 &
node tools/check.js http://127.0.0.1:8090    # skärmdumpar, sidled-scroll, filmknappen; AXE_PATH=… för axe
```

Uppmätt lokalt 9 november 2026: Lighthouse 100/100/100/100 i mobil och dator, 74 kB, LCP 1,2 s (simulerat långsamt 4G) och 0,3 s (dator).

## Filmen

Källkoden ligger i `film/src`. Siffran för laddtid är en parameter:

```bash
MEAS=0,4 sh film/build.sh     # skriver film/out/nollkomma-30s-9x16.mp4 och -4x5.mp4
```

Byt `MEAS` mot den uppmätta laddtiden från den riktiga sajten innan filmen publiceras. Kopiera sedan 4:5-versionen till `static/assets/film/` med nytt versionsnummer i filnamnet och uppdatera sökvägen i `src/index.html`.

## Kvar innan lansering

- [ ] Köp nollkomma.se (svensk domänleverantör; Cloudflare säljer inte .se)
- [ ] Cloudflare: konto, namnservrar, Pages-projekt, Email Routing, Web Analytics, AI-crawlers tillåtna
- [ ] Mät laddtiden på den riktiga sajten och rendera om filmen
- [ ] Foto till kontaktdelen
- [ ] Ett kundcase med tillstånd (före/efter)
