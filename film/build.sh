#!/bin/sh
# Renderar alla Nollkomma-filmer i båda formaten och lägger på ett tyst ljudspår.
# Användning: MEAS=0,4 sh film/build.sh            (MEAS = uppmätt laddtid som visas i filmerna)
#             MEAS=0,4 sh film/build.sh fart ai     (bara vissa filmer: full, fart, ai, pris)
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
  for fmt in 916 45; do
    CUT="$cut" node src/render.js "$fmt" video
    dir=$([ "$cut" = full ] && echo "out/$fmt" || echo "out/$fmt/$cut")
    name=$([ "$fmt" = 916 ] && echo 9x16 || echo 4x5)
    ffmpeg -v error -y -f concat -safe 0 -i "$dir/list.txt" -f lavfi -i anullsrc=r=48000:cl=stereo \
      -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart "out/$base-$name.tmp.mp4"
    mv "out/$base-$name.tmp.mp4" "out/$base-$name.mp4"
    echo "out/$base-$name.mp4"
  done
done
