#!/usr/bin/env python3
"""Bygger dist/ (det som läggs upp på Cloudflare Pages) och preview/ (förhandsvisningen) från src/ och static/.

    python3 tools/build.py
"""
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, STATIC, DIST, PREV = ROOT / "src", ROOT / "static", ROOT / "dist", ROOT / "preview"

base = (SRC / "base.css").read_text(encoding="utf-8")

# --- dist: den riktiga sajten -------------------------------------------------
shutil.rmtree(DIST, ignore_errors=True)
shutil.copytree(STATIC, DIST)
for name in ["index.html", "integritet.html", "404.html"]:
    html = (SRC / name).read_text(encoding="utf-8").replace("/*BASE*/", base)
    assert "/*BASE*/" not in html
    (DIST / name).write_text(html, encoding="utf-8")
for name in ["robots.txt", "llms.txt", "sitemap.xml", "_headers"]:
    shutil.copy(SRC / name, DIST / name)


# --- preview: samma sida som artifact (relativa sökvägar, inget eget <head>) ----
def relative(html: str) -> str:
    html = html.replace("url(/assets/", "url(assets/").replace('"/assets/', '"assets/').replace("'/assets/", "'assets/")
    html = html.replace('href="/integritet"', 'href="integritet.html"').replace('href="/llms.txt"', 'href="llms.txt"')
    html = html.replace('href="/#', 'href="./#').replace('href="/"', 'href="./"')
    return html


shutil.rmtree(PREV, ignore_errors=True)
PREV.mkdir()
idx = (DIST / "index.html").read_text(encoding="utf-8")
head = re.search(r"<head>(.*?)</head>", idx, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", idx, re.S).group(1)
style = re.search(r"<style>.*?</style>", head, re.S).group(0)
ld = re.search(r'<script type="application/ld\+json">.*?</script>', head, re.S).group(0)
# typsnitten bäddas in i förhandsvisningen, så att de alltid laddar där
import base64
for w in (400, 600, 700):
    f = f"familjen-grotesk-latin-{w}-normal.woff2"
    data = base64.b64encode((STATIC / "assets/fonts" / f).read_bytes()).decode()
    style = style.replace(f"url(/assets/fonts/{f})", f"url(data:font/woff2;base64,{data})")
page = ('<title>Nollkomma-sajten</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
        + style + "\n" + body + "\n" + ld + "\n")
# förhandsvisningen har inget API: testet och chatten visar märkta exempel där
page = page.replace('<script src="/assets/app.js" defer></script>', '<script>window.NK_DEMO=true</script>\n<script src="/assets/app.js" defer></script>')
assert "NK_DEMO" in page
(PREV / "index.html").write_text(relative(page), encoding="utf-8")
(PREV / "integritet.html").write_text(relative((DIST / "integritet.html").read_text(encoding="utf-8")), encoding="utf-8")
for name in ["robots.txt", "llms.txt"]:
    shutil.copy(SRC / name, PREV / name)

# --- besöksstatistik: bara på den riktiga sajten, inte i förhandsvisningen ---------
# Cloudflare lägger inte in skriptet själv på sidor som en Worker levererar. Token är publik.
BEACON = ("<script defer src=\"https://static.cloudflareinsights.com/beacon.min.js\" "
          "data-cf-beacon='{\"token\": \"9fc0c86fa10240578308c85bd890e4c7\"}'></script>")
for name in ["index.html", "integritet.html", "404.html"]:
    p = DIST / name
    html = p.read_text(encoding="utf-8")
    assert html.count("</body>") == 1
    p.write_text(html.replace("</body>", BEACON + "\n</body>"), encoding="utf-8")

print("dist:",sorted(str(p.relative_to(DIST)) for p in DIST.rglob("*") if p.is_file()))
print("preview:", sorted(str(p.relative_to(PREV)) for p in PREV.rglob("*") if p.is_file()))
