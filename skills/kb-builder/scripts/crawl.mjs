#!/usr/bin/env node
// Crawl a website into markdown files for a voice agent knowledge base.
// Usage: node crawl.mjs --url https://example.com [--max 40] [--out kb]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const start = arg('url');
const max = Number(arg('max', 40));
const out = arg('out', 'kb');
if (!start) { console.error('Usage: node crawl.mjs --url https://example.com [--max 40] [--out kb]'); process.exit(1); }

const origin = new URL(start).origin;
const SKIP = /\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|mp4|mp3|css|js|ico|xml)(\?|$)|\/(wp-admin|wp-json|cart|checkout|login|account|tag|author|feed)\b/i;

async function get(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'voice-agent-skills kb-builder' }, redirect: 'follow' });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function sitemapUrls() {
  const xml = await get(origin + '/sitemap.xml');
  if (!xml) return [];
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
  const nested = locs.filter(u => u.endsWith('.xml'));
  const pages = locs.filter(u => !u.endsWith('.xml'));
  for (const sm of nested.slice(0, 5)) {
    const x = await get(sm);
    if (x) pages.push(...[...x.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]).filter(u => !u.endsWith('.xml')));
  }
  return pages;
}

function decode(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
}

function toMarkdown(html) {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1].trim());
  let body = (html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<body[\s\S]*?<\/body>/i) || [html])[0];
  body = body
    .replace(/<(script|style|noscript|svg|iframe|form|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l, t) => `\n\n${'#'.repeat(Number(l))} ${t}\n\n`)
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|section|article|tr|li|ul|ol|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ');
  body = decode(body).split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const dedup = body.filter((l, i) => body.indexOf(l) === i);
  return { title, text: dedup.join('\n') };
}

function slug(url) {
  const p = new URL(url).pathname.replace(/\/$/, '') || '/home';
  return p.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60) || 'home';
}

const seen = new Set();
const queue = [start, ...(await sitemapUrls())];
mkdirSync(out, { recursive: true });
let saved = 0;

while (queue.length && saved < max) {
  const url = queue.shift().split('#')[0];
  if (seen.has(url) || !url.startsWith(origin) || SKIP.test(url)) continue;
  seen.add(url);
  const html = await get(url);
  if (!html) continue;
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/g)) {
    try { const u = new URL(m[1], url).href; if (u.startsWith(origin) && !seen.has(u)) queue.push(u); } catch {}
  }
  const { title, text } = toMarkdown(html);
  if (text.length < 200) continue;
  const file = join(out, `${slug(url)}.md`);
  writeFileSync(file, `# ${title}\n\nSource: ${url}\n\n${text}\n`);
  saved++;
  console.log(`saved ${file}`);
}
console.log(`\nDone. ${saved} pages in ./${out}. Review and clean them before uploading.`);
