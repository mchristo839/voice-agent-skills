#!/usr/bin/env node
// Upload a folder of markdown/text/pdf files (and optional URLs) as a Retell knowledge base.
// Usage: node upload.mjs --name "Acme KB" --dir kb [--urls https://a.com/faq,https://a.com/pricing] [--refresh]
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { retell, arg } from './_retell.mjs';

const name = arg('name');
const dir = arg('dir', 'kb');
const urls = arg('urls');
const refresh = arg('refresh', false) === true;

if (!name || name.length >= 40) {
  console.error('Pass --name with fewer than 40 characters, e.g. --name "Acme Plumbing KB"');
  process.exit(1);
}

const types = { '.md': 'text/markdown', '.txt': 'text/plain', '.pdf': 'application/pdf', '.csv': 'text/csv', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const files = existsSync(dir) ? readdirSync(dir).filter(f => types[extname(f).toLowerCase()]) : [];
if (!files.length && !urls) { console.error(`No files in ./${dir} and no --urls given.`); process.exit(1); }
if (files.length > 25) { console.error(`Retell allows 25 files per knowledge base. You have ${files.length}. Merge some first.`); process.exit(1); }

const form = new FormData();
form.append('knowledge_base_name', name);
for (const f of files) {
  const buf = readFileSync(join(dir, f));
  form.append('knowledge_base_files', new Blob([buf], { type: types[extname(f).toLowerCase()] }), f);
}
if (urls) for (const u of String(urls).split(',').map(s => s.trim()).filter(Boolean)) form.append('knowledge_base_urls', u);
if (refresh) form.append('enable_auto_refresh', 'true');

const kb = await retell('POST', '/create-knowledge-base', undefined, { form });
console.log(`Created knowledge base ${kb.knowledge_base_id} (${files.length} files${urls ? ' + urls' : ''}). Status: ${kb.status || 'in progress'}`);

mkdirSync('.voice-agent', { recursive: true });
const statePath = '.voice-agent/state.json';
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
state.knowledge_base_ids = [...new Set([...(state.knowledge_base_ids || []), kb.knowledge_base_id])];
writeFileSync(statePath, JSON.stringify(state, null, 2));
console.log(`Saved to ${statePath}. retell-deploy will attach it.`);
