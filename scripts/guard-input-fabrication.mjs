#!/usr/bin/env node
// Anti-bot guard — fails the build if any plugin contains an input-fabrication / trusted-input
// bypass that would help bot EvilQuest.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['packages'];
const EXTS = new Set(['.ts', '.js', '.mjs', '.cjs', '.tsx', '.jsx']);
const SKIP_DIR = new Set(['node_modules', 'dist', 'out', 'build', '.git', '.turbo']);

const RULES = [
  { re: /\bsendInputActivity\b/, msg: "calls the game's input-activity fn (mints an anti-bot ticket without a real user event)" },
  { re: /\b(consumePendingInputTicket|pendingInputTicketSeq|sendInputTicket|inputTicketBurst)\b/, msg: 'touches EvilQuest input-ticket internals (ticket forgery)' },
  { re: /new\s+(KeyboardEvent|PointerEvent|TouchEvent)\b/, msg: 'constructs a synthetic input event (fabricated game input)' },
  { re: /new\s+MouseEvent\s*\(\s*["'](?!contextmenu\b)/, msg: 'constructs a synthetic mouse input event (fabricated game input)' },
  { re: /\b(robotjs|nut-js|@nut-tree)\b/, msg: 'OS-level input automation library (auto-clicker / bot)' },
];

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.has(extname(name))) out.push(p);
  }
}

const files = [];
for (const r of ROOTS) walk(r, files);

const violations = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/anti-bot:allow/.test(line)) return;
    for (const rule of RULES) {
      if (rule.re.test(line)) violations.push({ file, line: i + 1, text: line.trim(), msg: rule.msg });
    }
  });
}

if (violations.length) {
  console.error('\n❌ Anti-bot guard FAILED — input-fabrication / trusted-input bypass found:\n');
  for (const v of violations) console.error(`  ${v.file}:${v.line}\n    ${v.text}\n    ↳ ${v.msg}\n`);
  process.exit(1);
}
console.log(`✅ Anti-bot guard passed (${files.length} files scanned, no input-fabrication vectors).`);

