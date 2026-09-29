# llm-whisperer-termux-qwen

Run llm-whisperer browser mode for Qwen on Android/Termux. Gives you an
OpenAI-compatible API at http://127.0.0.1:9777/v1/chat/completions proxying
to Qwen's web UI.

Verified on Termux aarch64, Chromium 138, Node 26, Playwright 1.48.

## Why this exists

Playwright browser mode fails on Termux for four reasons:

1. Unsupported platform: android — patched in coreBundle.js
2. Bundled Chromium is glibc, not Bionic — bypassed via CDP
3. net::ERR_ABORTED on SPAs — waitUntil changed to commit
4. ARM64 renderer crash — needs --single-process --no-zygote

## Install

    pkg install x11-repo
    pkg install chromium nodejs tigervnc
    npm install -g llm-whisperer

    COREBUNDLE=$(npm root -g)/llm-whisperer/node_modules/playwright-core/lib/coreBundle.js
    node patches/patch-android-platform.mjs "$COREBUNDLE"
    ./patches/patch-waituntil.sh

    cp .env.example ~/.env
    # edit ~/.env and set WSPR_VAULT_KEY

## First-time login (VNC)

    ./scripts/vnc-login.sh
    # connect a VNC viewer to 127.0.0.1:5901
    # in another session run: wspr login qwen
    # log in to Qwen in the VNC window, then press Enter

## Daily use

    ./scripts/start-qwen.sh

Then test:

    curl -s http://127.0.0.1:9777/v1/chat/completions \
      -H "Content-Type: application/json" \
      -d '{"model":"qwen","messages":[{"role":"user","content":"hi"}]}'

## Files

- patches/patch-android-platform.mjs — fixes Unsupported platform: android
- patches/patch-waituntil.sh — fixes SPA ERR_ABORTED
- scripts/start-qwen.sh — daily startup
- scripts/vnc-login.sh — one-time interactive login

## Session lifetime

Qwen's refresh token lasts about 30 days. If it expires, redo the VNC login.
