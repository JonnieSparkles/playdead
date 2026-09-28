# Promo video

Scripts that record a ~36s 1080p promo of the live site (`playdead.turbo-gateway.com`) and cut it together with ffmpeg.

## Requirements

- Node 18+ with Playwright (`npm i playwright`, then `npx playwright install chromium`)
- Python 3
- ffmpeg with libx264, libvpx and libopus (set `FFMPEG=/path/to/ffmpeg` if it's not on `PATH`)

## Usage

```sh
./prepare.sh               # download the music bed and the 1976 video clip
node record.mjs            # record all shots into seg/ (or name some: node record.mjs f_end)
python3 assemble.py        # -> playdead-promo.mp4
python3 assemble.py --silent   # -> playdead-promo-silent.mp4, no audio
```

## Shots

| Shot | Content |
| --- | --- |
| `a_title` | Title card (`card.html`) |
| `b_home` | Homepage catalog, scroll |
| `c_player` | Barton Hall 5/8/77 playing, laser show modes |
| `d_video` | Capitol Theatre 6/19/76 video album |
| `e_load` | Load Tape with a TXID |
| `f_end` | End card with `playdead.ar.io` |

Captions and card text are set in `record.mjs`; trims are in the `cuts` list in `assemble.py`.

## Notes

- Playwright's Chromium can't play H.264, so `record.mjs` swaps the Capitol Theatre reel for the VP9 clip from `prepare.sh`. The player UI around it is the real page.
- `c_player` sets the track to `BED_START` (110s) and `assemble.py` lines the music bed up with it, so the on-screen clock matches the audio.
- Behind a TLS-intercepting proxy, put the base64 SHA-256 SPKI hash of the proxy's CA in `spki.txt` and Chromium will trust that CA:
  `openssl x509 -in ca.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64 > spki.txt`
- The audio is a Grateful Dead audience recording and a video clip. YouTube's Content ID may flag it.
