#!/usr/bin/env python3
"""Bygger ljudspåret till Nollkomma-filmerna i kod: ljudeffekter som följer bilden och en lugn musikmatta.

    MEAS=0,4 python3 film/sound.py full out/ljud-full.wav
    (full | fart | ai | pris — kortfilmerna klipps på samma ställen som bilden, se src/cuts.json)

Allt ljud är syntetiserat här, så det finns inga licenser att hålla reda på.
"""
import json, os, pathlib, sys, wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
LEN = 30.0
MEAS_S = float(os.environ.get("MEAS", "0,4").replace(",", "."))
rng = np.random.default_rng(7)  # samma brus varje gång, så att ljudet går att återskapa exakt

FX = 1.9      # ljudeffekternas nivå mot musikmattan
SCALE = FX
L = np.zeros(int(SR * (LEN + 3)))
R = np.zeros_like(L)


def put(sig, t, gain=1.0, pan=0.0):
    """Lägg in ett ljud vid tiden t. pan: -1 vänster … 1 höger."""
    i = int(round(t * SR))
    n = min(len(sig), len(L) - i)
    if n <= 0 or i < 0:
        return
    a = (pan + 1) * np.pi / 4
    L[i:i + n] += sig[:n] * gain * SCALE * np.cos(a) * 1.4142
    R[i:i + n] += sig[:n] * gain * SCALE * np.sin(a) * 1.4142


def tt(d):
    return np.arange(int(SR * d)) / SR


def filt(x, kind, hz, order=2):
    return sosfilt(butter(order, hz, kind, fs=SR, output="sos"), x)


def env_exp(d, tau, attack=0.003):
    t = tt(d)
    return np.minimum(1, t / attack) * np.exp(-t / tau)


def tone(freq, d, tau, harmonics=(1.0,), attack=0.003):
    t = tt(d)
    s = sum(a * np.sin(2 * np.pi * freq * (k + 1) * t) for k, a in enumerate(harmonics))
    return s * env_exp(d, tau, attack)


def tick(freq=2100):
    d = 0.05
    return (0.6 * tone(freq, d, 0.008) + 0.5 * filt(rng.standard_normal(int(SR * d)), "high", 3000) * env_exp(d, 0.004))


def key():
    d = 0.03
    return filt(rng.standard_normal(int(SR * d)), "band", [1800, 6000]) * env_exp(d, 0.005) * rng.uniform(0.6, 1.0)


def pop(f0=620, f1=310, d=0.09):
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, 0.03)


def plink(freq, d=0.6):
    return tone(freq, d, 0.16, (1.0, 0.35, 0.12))


def bell(freq, d=1.4):
    return tone(freq, d, 0.35, (1.0, 0.0, 0.45, 0.0, 0.2))


def whoosh(d=0.5, lo=300, hi=3500, up=True):
    """Brus som sveper i tonhöjd: ljudet av en scen som glider in."""
    n = int(SR * d)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    steps = 24
    for k in range(steps):  # svepet görs i korta bitar med var sitt bandpassfilter
        a, b = k * n // steps, (k + 1) * n // steps
        pos = (k + 0.5) / steps
        fc = lo * (hi / lo) ** (pos if up else 1 - pos)
        seg = filt(x[max(0, a - 2000):b], "band", [fc * 0.6, min(fc * 1.6, SR / 2 - 100)])
        out[a:b] = seg[-(b - a):]
    t = np.arange(n) / n
    return out * np.sin(np.pi * t) ** 1.5


def buzz(d=0.075, freq=150):
    t = tt(d)
    return filt(np.sign(np.sin(2 * np.pi * freq * t)), "low", 900) * np.minimum(1, t / 0.004) * np.minimum(1, (d - t) / 0.012)


def impact():
    d = 1.6
    t = tt(d)
    f = 62 * (40 / 62) ** np.minimum(1, t / 0.5)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, 0.35, 0.002)
    thump = filt(rng.standard_normal(len(t)), "low", 500) * env_exp(d, 0.05, 0.001)
    return 0.9 * sub + 0.5 * thump


def pad(freqs, start, end, gain, fade=0.5):
    """Mjuk ackordmatta: lätt förstämda sinustoner i stereo med långsam svävning."""
    global SCALE
    old, SCALE = SCALE, 1.0
    d = end - start + fade
    t = tt(d)
    e = np.minimum(1, t / fade) * np.minimum(1, (d - t) / fade)
    for k, f in enumerate(freqs):
        lfo = 1 + 0.12 * np.sin(2 * np.pi * (0.11 + 0.03 * k) * t + k)
        # En ton i mitten och två svagare, lätt förstämda kopior åt var sitt håll. Då blir det bredd i hörlurar
        # utan att tonen släcks ut när en mobil spelar upp vänster och höger som en kanal.
        for det, pan, amp in ((0.0, 0.0, 0.75), (-0.3, -0.7, 0.3), (0.3, 0.7, 0.3)):
            # övertonerna (2×, 3×, 4×) gör att mattan hörs även i en mobilhögtalare, som inte återger basen
            s = sum(a * np.sin(2 * np.pi * h * (f + det) * t) for h, a in ((1, 1.0), (2, 0.5), (3, 0.22), (4, 0.12))) * e * lfo
            put(s * amp, start - fade / 2, gain / len(freqs), pan)
    SCALE = old


def pluck(freq):
    d = 0.5
    return filt(tone(freq, d, 0.12, (1.0, 0.5, 0.25, 0.12)), "low", 2200)


# ---------------------------------------------------------------- tidslinjen (samma tider som i src/index.html)
T = dict(B=8.0, C=9.8, D=15.0, E=21.0, F=25.5)
D3, E3, Fs3, G3, A3, B3 = 146.83, 164.81, 185.0, 196.0, 220.0, 246.94
D4, E4, Fs4, G4, A4, B4 = 293.66, 329.63, 369.99, 392.0, 440.0, 493.88
D5, Fs5, A5, D6 = 587.33, 739.99, 880.0, 1174.66

# A: en sida som laddar. Låg, lite orolig ton och en klocka som tickar.
drone_t = tt(8.3)
drone = (np.sin(2 * np.pi * 73.42 * drone_t) + 0.5 * np.sin(2 * np.pi * 110.0 * drone_t) + 0.3 * np.sin(2 * np.pi * 77.78 * drone_t)
         + 0.35 * np.sin(2 * np.pi * 220.0 * drone_t) + 0.25 * np.sin(2 * np.pi * 311.13 * drone_t) + 0.18 * np.sin(2 * np.pi * 440.0 * drone_t))
drone *= np.minimum(1, drone_t / 0.6) * np.minimum(1, (8.3 - drone_t) / 0.3) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.5 * drone_t))
SCALE = 1.0
put(drone, 0.0, 0.085)
SCALE = FX
put(whoosh(0.5, 250, 1800), 0.05, 0.10)                       # mobilen glider in
for k in range(7):                                            # räknaren: ett tick per halv sekund, lite ljusare för varje
    put(tick(1900 + 90 * k), 0.35 + 0.5 * k, 0.20 + 0.02 * k, (-0.2, 0.2)[k % 2])
put(buzz(0.09, 140), 2.85, 0.16); put(buzz(0.09, 140), 2.99, 0.16)   # räknaren passerar 2,5 s och blir röd
put(whoosh(0.45, 400, 3000, up=False), 3.45, 0.16, -0.2)      # sidan sveps bort
for k in range(17):                                           # "frisör norrköping" skrivs in
    put(key(), 4.25 + 0.8 * k / 17 + rng.uniform(-0.008, 0.008), 0.20, rng.uniform(-0.3, 0.3))
for k, t0 in enumerate((5.15, 5.35, 5.49, 5.63)):             # svarskortet och raderna
    put(pop(520 + 40 * k, 300), t0, 0.10)
put(pop(360, 200, 0.12), 6.35, 0.20)                          # "Ditt företag?"
put(buzz(0.07, 120), 6.9, 0.14); put(buzz(0.07, 120), 7.05, 0.14)    # … finns inte med

# B: 0,4 → Nollkomma. Ett slag och ett ackord som löser upp spänningen.
put(impact(), T["B"], 0.55)
for f in (D3, A3, D4, Fs4, A4):
    put(tone(f, 2.6, 0.9, (1.0, 0.4, 0.15), 0.01), T["B"], 0.07, 0.3 if f > 250 else -0.3)
put(pop(700, 350, 0.1), T["B"] + 0.55, 0.10)
put(plink(D5), T["B"] + 0.82, 0.14); put(plink(A5), T["B"] + 0.98, 0.11, 0.3)

# Musikmatta från B: D-dur → h-moll (koden) → G-dur (det som ingår) → D-dur (slutskylten).
PAD = 0.11
pad((D3, A3, D4, Fs4), T["B"] + 0.3, T["D"], PAD)
pad((B3 / 2, Fs3, B3, D4), T["D"], T["E"], PAD)
pad((G3 / 2, D3, G3, B3), T["E"], T["F"], PAD)
pad((D3, A3, D4, Fs4, A4), T["F"], LEN, PAD * 1.15)
ARP = {"C": (D4, A4, Fs4, A4), "D": (B3, Fs4, D4, Fs4), "E": (G3, D4, B3, D4), "F": (D4, A4, Fs4, D5)}
t0, k = T["B"] + 0.8, 0
while t0 < LEN - 1.6:                                         # stilla plock i åttondelar som följer ackorden
    sec = "C" if t0 < T["D"] else "D" if t0 < T["E"] else "E" if t0 < T["F"] else "F"
    put(pluck(ARP[sec][k % 4]), t0, 0.055, (-0.35, 0.35)[k % 2])
    t0 += 0.4; k += 1

# C: sajten laddar på riktigt, och är klar direkt.
put(whoosh(0.45, 300, 2600), T["C"], 0.12)
L0 = T["C"] + 0.65; L1 = L0 + MEAS_S
zt = tt(max(0.12, MEAS_S))
put(np.sin(2 * np.pi * np.cumsum(500 * (1500 / 500) ** (zt / zt[-1])) / SR) * np.minimum(1, zt / 0.02) * np.minimum(1, (zt[-1] - zt) / 0.03), L0, 0.07)
put(bell(1318.5), L1 + 0.02, 0.20, 0.15); put(bell(1760.0, 1.0), L1 + 0.10, 0.10, -0.15)   # klar: bocken
put(plink(A5), T["C"] + 3.05, 0.10, -0.2)                     # "Uppmätt – inte utlovat."

# D: koden som Google och AI läser.
put(whoosh(0.5, 200, 1600, up=False), T["D"], 0.13)
for n, c0 in enumerate((T["D"] + 0.75, T["D"] + 1.85, T["D"] + 2.95)):
    put(pop(420, 260), c0, 0.09)
    for j in range(14):                                       # koden skrivs
        put(key(), c0 + 0.2 + 0.8 * j / 14 + rng.uniform(-0.01, 0.01), 0.13, rng.uniform(-0.4, 0.4))
put(bell(1174.66, 1.2), T["D"] + 4.15, 0.15); put(plink(Fs5), T["D"] + 4.8, 0.10, 0.25)   # AI-svaret, "Fakta från din sajt"

# E: det som ingår varje månad.
put(whoosh(0.45, 300, 2600), T["E"], 0.12)
for n, f in enumerate((D5, Fs5, A5, D6)):
    put(plink(f), T["E"] + 0.80 + 0.2 * n, 0.13, -0.3 + 0.2 * n)
put(pop(500, 300), T["E"] + 2.05, 0.12)                       # "Lokalt i Norrköping"

# F: slutskylten.
put(whoosh(0.5, 250, 2200), T["F"], 0.13)
put(impact(), T["F"] + 0.02, 0.28)
for n, (dt, f) in enumerate(((0.3, D5), (0.95, A5), (1.4, D6))):
    put(plink(f, 0.9), T["F"] + dt, 0.11, (-0.2, 0.2, 0.0)[n])


def main():
    cut = sys.argv[1] if len(sys.argv) > 1 else "full"
    out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else f"out/ljud-{cut}.wav")
    cuts = json.loads((pathlib.Path(__file__).parent / "src" / "cuts.json").read_text())
    if cut not in cuts:
        sys.exit(f"Okänd film: {cut}. Välj en av: {', '.join(cuts)}")
    master = np.stack([L, R])
    master = filt(master, "high", 35)
    parts, f = [], int(0.02 * SR)
    for seg in cuts[cut]:                                     # klipp på samma ställen som bilden, med 20 ms toning i skarvarna
        a, b = int(round(seg["from"] * SR)), int(round(seg["to"] * SR))
        part = master[:, a:b].copy()
        part[:, :f] *= np.linspace(0, 1, f); part[:, -f:] *= np.linspace(1, 0, f)
        parts.append(part)
    mix = np.concatenate(parts, axis=1)
    fo = int(0.9 * SR)
    mix[:, -fo:] *= np.linspace(1, 0, fo) ** 1.5              # slutet tonar ut
    mix *= 10 ** (float(os.environ.get("GAIN_DB", "3")) / 20)   # hamnar runt -16 LUFS, vanlig nivå i sociala medier
    mix = np.tanh(mix * 1.1) / 1.1                            # mjuk begränsning i stället för klippning
    peak = float(np.abs(mix).max())
    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"{out}: {mix.shape[1] / SR:.2f} s, topp {20 * np.log10(peak):.1f} dBFS")


if __name__ == "__main__":
    main()
