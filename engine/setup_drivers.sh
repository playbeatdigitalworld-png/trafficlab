#!/bin/bash
# Downloads portable "Chrome for Testing" + matching chromedriver into ./drivers/
# (no root needed). main.py finds them automatically via find_chromedriver().
set -e
cd "$(dirname "$0")"
mkdir -p drivers

PLATFORM="$(uname -s)"
case "$PLATFORM" in
  Linux)    PLAT="linux64" ;;
  Darwin)   PLAT="mac-arm64" ;;
  MINGW*|*) PLAT="win64" ;;
esac

echo "Platform: $PLAT"
VERSIONS_URL="https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json"

VERSION=$(curl -s --max-time 20 "$VERSIONS_URL" | python3 -c "
import json,sys
d=json.load(sys.stdin)['channels']['Stable']
print(d['version'])
")

echo "Downloading Chrome for Testing $VERSION ..."
BASE="https://storage.googleapis.com/chrome-for-testing-public/$VERSION/$PLAT"

curl -sL --max-time 300 -o /tmp/cft.zip   "$BASE/chrome-headless-shell-$PLAT.zip"
curl -sL --max-time 120 -o /tmp/cd.zip    "$BASE/chromedriver-$PLAT.zip"

unzip -q -o /tmp/cft.zip -d drivers
unzip -q -o /tmp/cd.zip  -d drivers
rm -f /tmp/cft.zip /tmp/cd.zip
chmod +x drivers/*/* 2>/dev/null || true

echo "Done. Installed into ./drivers/"
ls drivers
