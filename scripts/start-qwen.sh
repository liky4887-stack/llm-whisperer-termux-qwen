#!/data/data/com.termux/files/usr/bin/bash
# start-qwen.sh — one-shot launcher for Qwen via llm-whisperer on Termux.
# Idempotent: safe to run repeatedly; skips components that are already up.
#
# What it does:
#   1. Detects VNC (Xvnc running) vs headless, launches Chromium with CDP
#   2. Waits for the CDP endpoint to come up
#   3. Ensures a chat.qwen.ai tab exists in that Chromium
#   4. Starts wspr on 9777 if not already running
#   5. Smoke-tests a Qwen chat completion through the full chain

set -e

WSPR_DIR="$HOME/llm-whisperer-termux-qwen"
WSPR_URL="http://127.0.0.1:9777"
CDP_URL="http://127.0.0.1:9222"
PROFILE_DIR="$HOME/.llm-whisperer-chrome"
CHROMIUM_LOG="$HOME/chromium.log"
WSPR_LOG="$HOME/wspr.log"
QWEN_TAB="https://chat.qwen.ai/"

# wspr needs CDP_URL set so it attaches to our Chromium instead of launching
# its own bundled one (which cannot run on Termux/Bionic).
export CDP_URL="$CDP_URL"
export HEADLESS=true

if [ ! -d "$WSPR_DIR" ]; then
  echo "ERROR: $WSPR_DIR missing"
  exit 1
fi

# ─── 1/4 Chromium ──────────────────────────────────────────────────
if pgrep -x Xvnc >/dev/null 2>&1; then
  MODE="vnc"; export DISPLAY=:1
  CH_FLAGS="--no-sandbox --disable-gpu --disable-dev-shm-usage"
else
  MODE="headless"
  CH_FLAGS="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --single-process --no-zygote"
fi

echo -n "[1/4] Chromium ($MODE) "
if curl -sf -m 2 "$CDP_URL/json/version" >/dev/null 2>&1; then
  echo "— already running on 9222"
else
  rm -f "$PROFILE_DIR/Singleton"* 2>/dev/null || true
  export LD_PRELOAD="$PREFIX/lib/libtermux-exec.so"
  nohup chromium-browser \
    $CH_FLAGS \
    --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 \
    --user-data-dir="$PROFILE_DIR" \
    --no-first-run --no-default-browser-check \
    about:blank \
    > "$CHROMIUM_LOG" 2>&1 &
  disown
  for i in $(seq 1 20); do
    if curl -sf -m 1 "$CDP_URL/json/version" >/dev/null 2>&1; then
      echo "— ready"
      break
    fi
    echo -n "."
    sleep 1
  done
  if ! curl -sf -m 2 "$CDP_URL/json/version" >/dev/null 2>&1; then
    echo " — FAILED"
    tail -5 "$CHROMIUM_LOG"
    exit 1
  fi
fi

# ─── 2/4 Qwen tab ──────────────────────────────────────────────────
echo -n "[2/4] Qwen tab "
QWEN_OPEN=$(curl -s "$CDP_URL/json/list" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  print('yes' if any(t.get('type')=='page' and t.get('url','').startswith('https://chat.qwen.ai') for t in d) else 'no')
except Exception: print('no')
")
if [ "$QWEN_OPEN" = "yes" ]; then
  echo "— already open"
else
  curl -sf -X PUT "$CDP_URL/json/new?$QWEN_TAB" >/dev/null
  echo "— opened, letting app bootstrap"
  sleep 8
fi

# ─── 3/4 llm-whisperer ─────────────────────────────────────────────
echo -n "[3/4] llm-whisperer "
if curl -sf -m 2 "$WSPR_URL/v1/models" >/dev/null 2>&1; then
  echo "— already running on 9777"
else
  cd "$WSPR_DIR"
  nohup wspr serve >> "$WSPR_LOG" 2>&1 &
  disown
  for i in $(seq 1 15); do
    if curl -sf -m 2 "$WSPR_URL/v1/models" >/dev/null 2>&1; then
      echo "— ready"
      break
    fi
    echo -n "."
    sleep 1
  done
  if ! curl -sf -m 2 "$WSPR_URL/v1/models" >/dev/null 2>&1; then
    echo " — FAILED"
    tail -10 "$WSPR_LOG"
    exit 1
  fi
fi

# ─── 4/4 Smoke test ────────────────────────────────────────────────
echo "[4/4] Smoke test (up to 60s)"
T0=$(date +%s)
RESP=$(curl -s -m 60 -X POST "$WSPR_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen","messages":[{"role":"user","content":"reply with just OK"}]}')
T1=$(date +%s)
DURATION=$((T1 - T0))
echo "$RESP" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  c=d['choices'][0]['message']['content']
  print('  OK: ' + c[:80])
except Exception as e:
  print('  FAIL:', str(e))
" 2>/dev/null
echo "  took: ${DURATION}s"
