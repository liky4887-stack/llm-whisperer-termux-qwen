#!/usr/bin/env node
// Reapply wspr's send-button click timeout fix to dist/providers/base.js.
// Needed after any `npm install -g llm-whisperer` upgrade.
// Idempotent — safe to run repeatedly.
//
// Usage:
//   node patch-base-sendclick.mjs [path/to/dist/providers/base.js]
// Default path: $(npm root -g)/llm-whisperer/dist/providers/base.js

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const argPath = process.argv[2];
const defaultPath = (() => {
  try {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return root + '/llm-whisperer/dist/providers/base.js';
  } catch { return null; }
})();
const target = argPath || defaultPath;

if (!target || !existsSync(target)) {
  console.error('base.js not found. Pass path as argument.');
  process.exit(1);
}

let src = readFileSync(target, 'utf8');

// Already patched?
if (src.includes('send.click({ timeout: 90000, force: true })')) {
  console.log('Already patched:', target);
  process.exit(0);
}

const old = '            await send.click();\n';
const neu = '            await send.click({ timeout: 90000, force: true });\n';

if (!src.includes(old)) {
  console.error('send.click() anchor not found — base.js layout changed');
  process.exit(1);
}

src = src.replace(old, neu);
const backup = target + '.before-termux-patch-' + Date.now();
writeFileSync(backup, readFileSync(target));
writeFileSync(target, src);
console.log('Patched:', target);
console.log('Backup:', backup);
