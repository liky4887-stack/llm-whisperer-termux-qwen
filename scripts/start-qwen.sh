#!/data/data/com.termux/files/usr/bin/bash
set -e

set -a; source ~/.env; set +a

pkill -9 -f chromium 2>/dev/null || true
sleep 1
rm -f ~/.llm-whisperer-chrome/Singleton*

export LD_PRELOAD=$PREFIX/lib/libtermux-exec.so
nohup chromium-browser \
  --headless=new \
  --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 \
  --user-data-dir=$HOME/.llm-whisperer-chrome \
  --single-process --no-zygote \
  about:blank \
  > ~/chromium.log 2>&1 &

echo -n "Waiting for CDP"
for i in $(seq 1 15); do
  if curl -sf http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
    echo " — ready"
    break
  fi
  echo -n "."
  sleep 1
done

echo "Starting wspr serve on port ${PORT:-9777}..."
exec wspr serve
