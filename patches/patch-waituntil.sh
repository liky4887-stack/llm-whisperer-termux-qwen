#!/data/data/com.termux/files/usr/bin/bash
set -e

DIST="${1:-/data/data/com.termux/files/usr/lib/node_modules/llm-whisperer/dist}"

if [ ! -d "$DIST" ]; then
  echo "Not found: $DIST"
  exit 1
fi

cp -r "$DIST" "${DIST}.bak"

grep -rl 'waitUntil: "domcontentloaded"' "$DIST" \
  | while read f; do
      sed -i 's/waitUntil: "domcontentloaded"/waitUntil: "commit"/g' "$f"
      echo "Patched: $f"
    done

echo "Done."
