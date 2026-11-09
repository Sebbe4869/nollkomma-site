#!/bin/sh
# Renderar Nollkomma-filmen i båda formaten och lägger på ett tyst ljudspår.
# Användning: MEAS=0,4 sh film/build.sh   (MEAS = uppmätt laddtid som visas i filmen)
set -e
cd "$(dirname "$0")"
for fmt in 916 45; do
  node src/render.js "$fmt" video
  name=$([ "$fmt" = 916 ] && echo 9x16 || echo 4x5)
  ffmpeg -v error -y -f concat -safe 0 -i "out/$fmt/list.txt" -f lavfi -i anullsrc=r=48000:cl=stereo \
    -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart "out/nollkomma-30s-$name.tmp.mp4"
  mv "out/nollkomma-30s-$name.tmp.mp4" "out/nollkomma-30s-$name.mp4"
  echo "out/nollkomma-30s-$name.mp4"
done
