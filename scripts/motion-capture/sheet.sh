#!/bin/bash
# Contact sheet of the frames frames.swift saved between two times, each labelled with its time and the step
# since the frame before (a long step mid-animation is a stutter). Needs ImageMagick.
#   scripts/motion-capture/sheet.sh <frames-dir> <from-ms> <to-ms> <out.png> [every=1] [columns=10] [zero-ms]
# `every` is every nth frame (3) or one frame per interval (100ms). With `zero-ms`, labels count from that time
# (say, the frame where Save was tapped), so two recordings line up side by side.
set -euo pipefail
DIR=$1; FROM=$2; TO=$3; OUT=$4; EVERY=${5:-1}; COLS=${6:-10}; ZERO=${7:-}
args=(); i=0; next=$FROM
while IFS=$'\t' read -r n ms step; do
  [ "$n" = frame ] && continue
  (( ms < FROM || ms > TO )) && continue
  if [[ $EVERY == *ms ]]; then (( ms < next )) && continue; next=$(( next + ${EVERY%ms} ))
  else (( i++ % EVERY )) && continue; fi
  label="${ms}ms +${step}"; [ -n "$ZERO" ] && label="$(( ms - ZERO )) ms"
  args+=(-label "$label" "$(printf "%s/frame-%04d-%06d.png" "$DIR" "$n" "$ms")")
done < "$DIR/frames.tsv"
montage "${args[@]}" -tile "${COLS}x" -geometry +3+3 -pointsize 18 -background white "$OUT"
echo "$OUT ($(( ${#args[@]} / 3 )) frames)"
