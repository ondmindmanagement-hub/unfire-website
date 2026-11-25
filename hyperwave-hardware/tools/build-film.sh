#!/bin/zsh
# Builds the Hyperwave 2000 digital concept film from authentic frame captures + typography overlays.
# Usage: build-film.sh <framesDir> <overlaysDir> <outDir>
set -e
F=$1; O=$2; OUT=$3
mkdir -p $OUT
# overlay timing (seconds): name start end
cards=(title 0.4 3.0  m1 3.2 5.0  m2 5.1 7.0  m3 7.1 9.0  m4 9.1 11.4  s1 11.8 14.8  s2 15.2 17.9  s3 18.2 20.4  s4 20.7 23.4  end 23.6 26.5)
inputs=(-framerate 24 -i $F/film-%04d.jpg)
fc="[0:v]format=yuv420p,eq=brightness=-0.03:saturation=0.97,vignette=PI/5,format=rgba[b0];"
i=1; prev=b0
for ((k=1; k<=${#cards}; k+=3)); do
  n=${cards[k]}; s=${cards[k+1]}; e=${cards[k+2]}; d=$(( e - s ))
  inputs+=(-loop 1 -t 26.5 -i $O/$n.png)
  fo=$(( e - 0.45 ))
  fc+="[$i:v]format=rgba,fade=t=in:st=$s:d=0.45:alpha=1,fade=t=out:st=$fo:d=0.45:alpha=1[o$i];[$prev][o$i]overlay=0:0:enable='between(t,$s,$e)'[b$i];"
  prev=b$i; i=$((i+1))
done
inputs+=(-loop 1 -t 26.5 -i $O/label.png)
fc+="[$i:v]format=rgba[lab];[$prev][lab]overlay=0:0,fade=t=in:st=0:d=0.6,fade=t=out:st=25.9:d=0.6,format=yuv420p[v]"
ffmpeg -loglevel error -y $inputs -filter_complex "$fc" -map "[v]" -t 26.5 -c:v libx264 -preset veryfast -crf 19 -pix_fmt yuv420p -movflags +faststart \
  -metadata title="Hyperwave 2000 - Digital concept visualisation" -metadata comment="Captured from the real-time digital instrument; not physical hardware" \
  $OUT/hyperwave-2000-digital-concept-film-1080p.mp4
ffmpeg -loglevel error -y -i $OUT/hyperwave-2000-digital-concept-film-1080p.mp4 -vf scale=1280:-2 -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -movflags +faststart -an $OUT/hyperwave-film-720.mp4
ls -la $OUT
