#!/usr/bin/env node
// Recapture Qwen credentials from the live Chromium session.
// Pulls fresh cookies (incl. HttpOnly) + access token from the browser,
// writes them to ~/cookies/qwen-creds.json in the shape QwenCredentialStore
// expects. Backs up the old file first.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const CDP_HTTP = process.env.QWEN_CDP_URL || 'http://127.0.0.1:9222';
const OUT = join(homedir(), 'cookies', 'qwen-creds.json');

async function main() {
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const qwen = list.find(t => t.type === 'page' && t.url.startsWith('https://chat.qwen.ai'));
  if (!qwen) throw new Error('No chat.qwen.ai tab found via CDP at ' + CDP_HTTP);
  console.log('Qwen tab:', qwen.url);

  const ws = new WebSocket(qwen.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r);
    ws.addEventListener('error', () => j(new Error('ws error')));
    setTimeout(() => j(new Error('ws timeout')), 5000);
  });

  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const cdp = (method, params = {}) => new Promise((res, rej) => {
    const id = nextId++;
    pending.set(id, (m) => {
      if (m.error) rej(new Error('CDP ' + method + ': ' + JSON.stringify(m.error)));
      else res(m.result);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const { cookies } = await cdp('Network.getCookies', {
    urls: ['https://chat.qwen.ai/', 'https://qwen.ai/', 'https://auth.qwen.ai/'],
  });
  const sendable = cookies.filter(c =>
    c.domain === 'chat.qwen.ai' || c.domain === '.qwen.ai' || c.domain === 'qwen.ai');
  const seen = new Set();
  const unique = [];
  for (const c of sendable) {
    const key = c.domain + '|' + c.name;
    if (seen.has(key)) continue;
    seen.add(key); unique.push(c);
  }
  const cookieStr = unique.map(c => c.name + '=' + c.value).join('; ');
  console.log('Captured', unique.length, 'cookies, string length', cookieStr.length);

  const evalRes = await cdp('Runtime.evaluate', {
    expression: "localStorage.getItem('token') || ''",
    returnByValue: true,
  });
  const accessToken = evalRes.result.value;
  if (!accessToken || !accessToken.startsWith('eyJ')) {
    throw new Error('No valid access token in localStorage.token');
  }
  const parts = accessToken.split('.');
  const padded = parts[1] + '='.repeat((4 - parts[1].length % 4) % 4);
  const jwt = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  console.log('JWT exp:', new Date(jwt.exp * 1000).toISOString(), '(in', jwt.exp - now, 's)');

  let existing = {};
  if (existsSync(OUT)) {
    try { existing = JSON.parse(readFileSync(OUT, 'utf8')); } catch {}
  }
  const refreshCookie = unique.find(c => c.name === 'refresh_token');
  const out = {
    cookies: cookieStr,
    accessToken,
    refreshToken: refreshCookie ? refreshCookie.value : existing.refreshToken,
    bxUa: existing.bxUa,
    bxUmidToken: existing.bxUmidToken,
    bxV: existing.bxV,
    timezone: new Date().toString(),
    acquiredAt: Date.now(),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  if (existsSync(OUT)) {
    const backup = OUT + '.before-recapture-' + Date.now();
    writeFileSync(backup, readFileSync(OUT), { mode: 0o600 });
    console.log('Backup:', backup);
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2), { mode: 0o600 });
  console.log('Wrote', OUT);
  console.log('  cookies:', cookieStr.length, 'chars');
  console.log('  accessToken:', accessToken.length, 'chars');
  console.log('  refreshToken:', refreshCookie ? 'from cookie' : 'preserved');
  console.log('  bxUa/bxUmidToken/bxV:', out.bxUa ? 'preserved' : 'MISSING');
  ws.close();
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
