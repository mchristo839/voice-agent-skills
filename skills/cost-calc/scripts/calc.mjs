#!/usr/bin/env node
// Compare voice agent costs across platforms.
// Usage: node calc.mjs (--calls 1000 --avg-min 3 | --minutes 3000) [--llm 0.02] [--telephony 0.014] [--margin 60] [--rates file]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const here = dirname(fileURLToPath(import.meta.url));
const R = JSON.parse(readFileSync(arg('rates', join(here, '..', 'rates.json')), 'utf8'));

const calls = arg('calls') ? Number(arg('calls')) : null;
const avg = Number(arg('avg-min', 3));
const minutes = arg('minutes') ? Number(arg('minutes')) : (calls ?? 1000) * avg;
const llmGiven = arg('llm') != null;
const telGiven = arg('telephony') != null;
const llm = llmGiven ? Number(arg('llm')) : R.assumed_defaults.llm_per_min;
const tel = telGiven ? Number(arg('telephony')) : R.assumed_defaults.telephony_per_min;
const margin = arg('margin') ? Number(arg('margin')) / 100 : null;
const cur = R.currency || 'USD';

const ageDays = Math.floor((Date.now() - new Date(R.checked).getTime()) / 864e5);
if (ageDays > 60) console.log(`WARNING: rates were last checked ${ageDays} days ago (${R.checked}). Update rates.json from the pricing pages first.\n`);

const f = x => x.toFixed(3);
const m = x => `${cur} ${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rows = [];

for (const [id, p] of Object.entries(R.platforms)) {
  const lines = [];
  for (const [k, v] of Object.entries(p.per_min || {})) lines.push({ k, v, src: 'published' });
  for (const [k, v] of Object.entries(p.assumed_per_min || {})) lines.push({ k, v, src: 'assumed' });
  if (!p.llm_included) lines.push({ k: 'llm', v: llm, src: llmGiven ? 'you' : 'assumed' });
  if (!p.telephony_included) lines.push({ k: 'telephony', v: tel, src: telGiven ? 'you' : 'assumed' });
  const perMin = lines.reduce((s, l) => s + l.v, 0);
  rows.push({ id, label: p.label, lines, perMin, notes: p.notes });
}
rows.sort((a, b) => a.perMin - b.perMin);

console.log(`Volume: ${minutes.toLocaleString()} minutes/month${calls ? ` (${calls} calls x ${avg} min)` : ''}\n`);
for (const r of rows) {
  console.log(`${r.label}: ${cur} ${f(r.perMin)}/min  ->  ${m(r.perMin * minutes)}/month${calls ? `, ${m(r.perMin * avg)} per call` : ''}`);
  for (const l of r.lines) console.log(`   ${l.k.padEnd(15)} ${f(l.v)}  ${l.src}`);
  console.log(`   ${r.notes}\n`);
}

if (margin != null) {
  if (margin >= 1) { console.error('--margin must be under 100'); process.exit(1); }
  const cheapest = rows[0];
  const price = cheapest.perMin / (1 - margin);
  console.log(`Pricing on ${cheapest.label} at ${Math.round(margin * 100)}% margin:`);
  console.log(`   ${cur} ${price.toFixed(2)}/min, or a ${m(Math.ceil(price * minutes / 50) * 50)}/month retainer for ${minutes.toLocaleString()} minutes`);
  console.log('   Add your build fee, support time and number rental on top.\n');
}
console.log(`Rates checked ${R.checked}. Sources: ${Object.values(R.sources).join(' , ')}`);
console.log('Not included: number rental, concurrency, compliance add-ons, premium voices, SMS.');
