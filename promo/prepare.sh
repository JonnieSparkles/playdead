#!/usr/bin/env bash
# Fetches the media inputs the promo uses from Arweave.
set -euo pipefail
cd "$(dirname "$0")"
FFMPEG="${FFMPEG:-ffmpeg}"
GW="${GATEWAY:-https://turbo-gateway.com}"

# Music bed: Grateful Dead, Barton Hall 1977-05-08, "Scarlet Begonias > Fire on the Mountain"
[ -f scarlet.mp3 ] || curl -fsSL -o scarlet.mp3 "$GW/OlWxNTtgnkP1wvbF-gHAJKRoW1lCMNYSZebCoAVSxoI"

# 25s of the Capitol Theatre 1976-06-19 reel, transcoded to VP9 because Playwright's Chromium has no H.264
if [ ! -f clip1976.webm ]; then
  "$FFMPEG" -loglevel error -y -ss 00:34:50 -i "$GW/CbO66XUUjRNQpYpcOsS1KhnOusXeu46VlVHoRevnYg4" -t 25 \
    -c:v libvpx-vp9 -b:v 2M -c:a libopus clip1976.webm
fi
[ -f clip1976.wav ] || "$FFMPEG" -loglevel error -y -i clip1976.webm -vn clip1976.wav
echo "ready"
