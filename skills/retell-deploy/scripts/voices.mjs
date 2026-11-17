#!/usr/bin/env node
// List Retell voices, optionally filtered.
// Usage: node voices.mjs [--accent Australian] [--gender female] [--provider elevenlabs]
import { retell, arg } from './_retell.mjs';

const accent = arg('accent');
const gender = arg('gender');
const provider = arg('provider');

const voices = await retell('GET', '/list-voices');
const rows = voices.filter(v =>
  (!accent || (v.accent || '').toLowerCase().includes(String(accent).toLowerCase())) &&
  (!gender || v.gender === gender) &&
  (!provider || v.provider === provider));

for (const v of rows) console.log(`${v.voice_id.padEnd(32)} ${v.voice_name.padEnd(16)} ${(v.gender || '').padEnd(7)} ${(v.accent || '-').padEnd(12)} ${v.provider}`);
console.log(`\n${rows.length} voices. Preview them in the Retell dashboard before you pick.`);
