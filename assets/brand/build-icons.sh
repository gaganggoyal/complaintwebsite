#!/usr/bin/env bash
# Rasterise the brand SVGs into every icon size the site references.
#
# Run from anywhere; writes into this directory and the project root.
# Requires rsvg-convert and ImageMagick (brew install librsvg imagemagick).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

need() { command -v "$1" >/dev/null || { echo "missing: $1" >&2; exit 1; }; }
need rsvg-convert
need magick

png() { rsvg-convert -w "$2" -h "$2" "$DIR/$1" -o "$DIR/$3"; echo "  $3 (${2}px)"; }

echo "Icons:"
png mark.svg          192 icon-192.png
png mark.svg          512 icon-512.png
png mark-maskable.svg 192 icon-192-maskable.png
png mark-maskable.svg 512 icon-512-maskable.png

# iOS ignores transparency and applies its own corner radius, so the maskable
# (full-bleed) artwork is the correct source here — the rounded one would show
# a dark halo where its corners fall outside Apple's mask.
png mark-maskable.svg 180 apple-touch-icon.png
cp "$DIR/apple-touch-icon.png" "$ROOT/apple-touch-icon.png"
echo "  apple-touch-icon.png -> project root (Safari requests it there)"

# Multi-resolution .ico for legacy browsers and Windows shortcuts.
rsvg-convert -w 16 -h 16 "$ROOT/favicon.svg" -o "$DIR/.f16.png"
rsvg-convert -w 32 -h 32 "$ROOT/favicon.svg" -o "$DIR/.f32.png"
rsvg-convert -w 48 -h 48 "$ROOT/favicon.svg" -o "$DIR/.f48.png"
magick "$DIR/.f16.png" "$DIR/.f32.png" "$DIR/.f48.png" "$ROOT/favicon.ico"
cp "$DIR/.f32.png" "$DIR/favicon-32.png"
rm -f "$DIR/.f16.png" "$DIR/.f32.png" "$DIR/.f48.png"
echo "  favicon.ico (16/32/48) -> project root"
echo "  favicon-32.png"

echo
echo "Social card:"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ] && command -v magick >/dev/null; then
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --screenshot="$DIR/.og.png" --window-size=1200,630 "$DIR/og.html" >/dev/null 2>&1
  # JPEG, not PNG: the card is a full-bleed gradient, where PNG costs ~5x the
  # bytes for no visible gain. Chat apps skip previews on heavy images.
  magick "$DIR/.og.png" -strip -quality 86 -sampling-factor 4:4:4 -interlace Plane "$DIR/og.jpg"
  rm -f "$DIR/.og.png"
  echo "  og.jpg (1200x630, $(( $(wc -c < "$DIR/og.jpg") / 1024 ))KB)"
else
  echo "  skipped — needs Google Chrome + ImageMagick (see og.html)"
fi
