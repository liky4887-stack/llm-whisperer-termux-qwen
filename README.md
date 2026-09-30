# llm-whisperer-termux-qwen

Run [llm-whisperer](https://github.com/aananda-giri/llm-whisperer) browser mode
for Qwen on Android/Termux. Exposes an OpenAI-compatible API at
`http://127.0.0.1:9777/v1/chat/completions` that drives the real chat.qwen.ai UI
in a local Chromium.

Verified on Termux aarch64, Chromium 138, Node 26, Playwright 1.48.

## Why this exists

Playwright browser mode fails on Termux for four reasons, all fixed here:

1. `Unsupported platform: android` — patched in `coreBundle.js`
2. Bundled Chromium is glibc, not Bionic — bypassed via CDP
3. `net::ERR_ABORTED` on SPAs — `waitUntil` changed to `commit`
4. ARM64 renderer crash — needs `--single-process --no-zygote`

After setup, additionally patched in-place:

- `providers.yaml`: Qwen `timeoutMs` 90s → 180s, `responseSelector` broadened
  (Qwen3.7 auto-thinking can exceed 90s before the answer node appears)
- `dist/providers/base.js`: send-button click timeout 30s → 90s with `force:true`
  (Qwen sometimes disables the send button during chat cleanup)

Both are reapplied by the scripts in `patches/` after any wspr upgrade.

## Install

    pkg install x11-repo
    pkg install chromium nodejs tigervnc
    npm install -g llm-whisperer

    COREBUNDLE=$(npm root -g)/llm-whisperer/node_modules/playwright-core/lib/coreBundle.js
    node patches/patch-android-platform.mjs "$COREBUNDLE"
    ./patches/patch-waituntil.sh

    cp .env.example ~/.env
    # edit ~/.env, set WSPR_VAULT_KEY

## After every `npm install -g llm-whisperer` upgrade

    node patches/patch-providers-yaml.mjs
    node patches/patch-base-sendclick.mjs

Both are idempotent — safe to run any time.

## One-time interactive login (VNC)

    ./scripts/vnc-login.sh
    # connect a VNC viewer to 127.0.0.1:5901
    # in another session: wspr login qwen
    # log in to Qwen in the VNC window, then press Enter

The session persists in ~/.llm-whisperer-chrome across restarts.

## Daily use

    ./scripts/start-qwen.sh

That script:

1. Detects VNC (Xvnc running) vs headless and launches Chromium with CDP
2. Opens a chat.qwen.ai tab if one isn't already open
3. Starts wspr on 9777 with CDP_URL exported
4. Runs a smoke test through the full chain

## Recapture the session

The Qwen accessToken expires roughly every 15 minutes and is rotated
automatically by the browser. To sync the current token to disk
(~/cookies/qwen-creds.json):

    node scripts/recapture-qwen-creds.mjs

Run this when a downstream consumer (e.g. sovereign-factory's direct-fetch
QwenService) needs a fresh token. Not needed for the wspr path itself.

## Consuming the API

    curl -s http://127.0.0.1:9777/v1/chat/completions \
      -H "Content-Type: application/json" \
      -d '{"model":"qwen","messages":[{"role":"user","content":"hi"}]}'

Returns OpenAI-shaped JSON. Latency 10–30s per call (real browser interaction).

## Files

- `patches/patch-android-platform.mjs` — fixes `Unsupported platform: android`
- `patches/patch-waituntil.sh` — fixes SPA `ERR_ABORTED`
- `patches/patch-providers-yaml.mjs` — Qwen timeout + selector (reapply after wspr upgrade)
- `patches/patch-base-sendclick.mjs` — send-button click timeout (reapply after wspr upgrade)
- `scripts/start-qwen.sh` — one-shot launcher, 4-phase
- `scripts/vnc-login.sh` — one-time interactive login
- `scripts/recapture-qwen-creds.mjs` — sync live session to ~/cookies/qwen-creds.json

## Session lifetime

Qwen rotates the `refresh_token` cookie roughly monthly. When it expires, redo
the VNC login. In between, the browser refreshes its own `accessToken` every
~15 minutes without intervention.
