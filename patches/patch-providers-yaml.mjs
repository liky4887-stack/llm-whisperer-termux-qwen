#!/usr/bin/env node
// Reapply Qwen timeout + selector fixes to llm-whisperer's providers.yaml.
// Needed after any `npm install -g llm-whisperer` upgrade.
// Idempotent — safe to run repeatedly.
//
// Usage:
//   node patch-providers-yaml.mjs [path/to/providers.yaml]
// Default path: $(npm root -g)/llm-whisperer/providers.yaml

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const argPath = process.argv[2];
const defaultPath = (() => {
  try {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return root + '/llm-whisperer/providers.yaml';
  } catch { return null; }
})();
const target = argPath || defaultPath;

if (!target || !existsSync(target)) {
  console.error('providers.yaml not found. Pass path as argument.');
  process.exit(1);
}

const MARKER = '# [termux-patch] qwen timeout/selector';
let src = readFileSync(target, 'utf8');

if (src.includes(MARKER) || src.includes('Broadened to cover Qwen UI variants')) {
  console.log('Already patched:', target);
  process.exit(0);
}

// 1. Broaden responseSelector
const selOld = '    responseSelector: ".custom-qwen-markdown"\n';
const selNew = '    # [termux-patch] qwen timeout/selector\n    responseSelector: ".custom-qwen-markdown, [class*=\'qwen-markdown\'], [class*=\'markdown-body\'], [class*=\'phase-answer\']"\n';
if (!src.includes(selOld)) {
  console.error('responseSelector anchor not found — providers.yaml layout changed');
  process.exit(1);
}
src = src.replace(selOld, selNew);

// 2. Bump timeoutMs from 90000 to 180000 under qwen
const toOld = '    timeoutMs: 90000\n    stabilizeMs: 2000\n    # Sized for an agent client';
const toNew = '    timeoutMs: 180000\n    stabilizeMs: 2000\n    # Sized for an agent client';
if (src.includes(toOld)) {
  src = src.replace(toOld, toNew);
} else {
  console.log('WARN: qwen timeoutMs anchor not found (already bumped or layout changed)');
}

const backup = target + '.before-termux-patch-' + Date.now();
writeFileSync(backup, readFileSync(target));
writeFileSync(target, src);
console.log('Patched:', target);
console.log('Backup:', backup);
