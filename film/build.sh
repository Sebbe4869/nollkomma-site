#!/bin/sh
# Renderar alla Nollkomma-filmer i båda formaten och lägger på ljudspåret från sound.py.
# Användning: MEAS=0,4 sh film/build.sh            (MEAS = uppmätt laddtid som visas i filmerna)
#             MEAS=0,4 sh film/build.sh fart ai     (bara vissa filmer: full, fart, ai, pris)
#             sh film/ljud.sh                       (byter bara ljudet på färdiga filmer, utan att rendera om bilden)
set -e
cd "$(dirname "$0")"
CUTS="${*:-full fart ai pris}"
for cut in $CUTS; do
  case "$cut" in
    full) base="nollkomma-30s" ;;
    fart) base="nollkomma-fart-15s" ;;
    ai)   base="nollkomma-ai-15s" ;;
    pris) base="nollkomma-pris-9s" ;;
    *) echo "Okänd film: $cut" >&2; exit 1 ;;
  esac
  python3 sound.py "$cut" "out/ljud-$cut.wav"   # ljudspåret byggs i kod och klipps som bilden
  for fmt in 916 45; do
    CUT="$cut" node src/render.js "$fmt" video
    dir=$([ "$cut" = full ] && echo "out/$fmt" || echo "out/$fmt/$cut")
    name=$([ "$fmt" = 916 ] && echo 9x16 || echo 4x5)
    ffmpeg -v error -y -f concat -safe 0 -i "$dir/list.txt" -i "out/ljud-$cut.wav" \
      -map 0:v -map 1:a -c:v copy -af apad -c:a aac -b:a 192k -shortest -movflags +faststart "out/$base-$name.tmp.mp4"
    mv "out/$base-$name.tmp.mp4" "out/$base-$name.mp4"
    echo "out/$base-$name.mp4"
  done
done
