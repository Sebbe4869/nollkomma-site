#!/bin/sh
# Bygger om ljudspåret och lägger det på de färdiga filmerna i out/. Bilden rörs inte.
# Användning: MEAS=0,4 sh film/ljud.sh     (GAIN_DB=… ändrar nivån, standard 3)
set -e
cd "$(dirname "$0")"
for pair in full:nollkomma-30s fart:nollkomma-fart-15s ai:nollkomma-ai-15s pris:nollkomma-pris-9s; do
  cut=${pair%%:*}; base=${pair#*:}
  python3 sound.py "$cut" "out/ljud-$cut.wav"
  for name in 9x16 4x5; do
    ffmpeg -v error -y -i "out/$base-$name.mp4" -i "out/ljud-$cut.wav" -map 0:v -map 1:a -c:v copy -af apad -c:a aac -b:a 192k -shortest -movflags +faststart "out/$base-$name.tmp.mp4"
    mv "out/$base-$name.tmp.mp4" "out/$base-$name.mp4"
  done
done
