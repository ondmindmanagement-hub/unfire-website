#!/bin/zsh
# Derives web media from authentic captures (crop/scale/compress only — no repainting).
# Usage: build-media.sh <captureRoot> <mediaOutDir>
set -e
C=$1; M=$2
mkdir -p $M/seq $C/tmp
# Scroll-driven transformation sequence: film frames 72..264 (the full T=0→4 transformation), every 4th frame.
n=0
for f in $(seq 72 4 264); do
  src=$C/film/film-$(printf %04d $f).jpg
  ffmpeg -loglevel error -y -i $src -vf "crop=1680:945:120:70,scale=1280:-2" $C/tmp/s.png
  cwebp -quiet -q 66 -m 6 $C/tmp/s.png -o $M/seq/t$(printf %02d $n).webp
  n=$((n+1))
done
echo "sequence frames: $n"
still() { # name src crop width quality
  ffmpeg -loglevel error -y -i $2 -vf "crop=$3,scale=$4:-2" $C/tmp/x.png && cwebp -quiet -q $5 -m 6 $C/tmp/x.png -o $M/$1.webp
}
S=$C/stills
still hero-hyper        $S/still-hyper-threequarter.png  2000:1250:200:110 1800 78
still closed-signature  $S/still-closed-threequarter.png 1500:938:450:300  1500 80
still closed-front      $S/still-closed-front.png        1500:938:450:280  1500 80
still open-front        $S/still-open-front.png          2000:1250:200:100 1600 78
still detail-controls   $S/still-detail-controls.png     2400:1500:0:0     1600 78
still detail-keys       $S/still-detail-keys.png         2400:1500:0:0     1600 78
still detail-speaker    $S/still-detail-speaker.png      2400:1500:0:0     1600 78
still hyper-wide        $S/still-hyper-wide-left.png     2000:1250:200:110 1600 78
ffmpeg -loglevel error -y -i $C/film/film-0600.jpg -vf scale=1280:-2 $C/tmp/p.png && cwebp -quiet -q 72 $C/tmp/p.png -o $M/film-poster.webp
cp $C/out/hyperwave-film-720.mp4 $M/hyperwave-2000-digital-concept-film.mp4
du -sh $M $M/seq; ls -la $M
