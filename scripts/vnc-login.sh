#!/data/data/com.termux/files/usr/bin/bash
set -e

set -a; source ~/.env; set +a

pkill -9 -f chromium 2>/dev/null || true
sleep 1
rm -f ~/.llm-whisperer-chrome/Singleton*

vncserver :1 -geometry 1280x720 -localhost no
export DISPLAY=:1

chromium-browser \
  --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 \
  --user-data-dir=$HOME/.llm-whisperer-chrome \
  --no-first-run --no-default-browser-check \
  --single-process --no-zygote \
  about:blank &

sleep 3
echo ""
echo "Connect a VNC viewer to 127.0.0.1:5901"
echo "Then in another session run: wspr login qwen"
echo "Log in via VNC, reach the chat screen, press Enter in the login command."
