// Tiny Retell API client. No dependencies. Node 18+.
// Reads RETELL_API_KEY from the environment or from a .env file in the current folder.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnv(file = '.env') {
  const p = resolve(process.cwd(), file);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

loadEnv();

const BASE = process.env.RETELL_BASE_URL || 'https://api.retellai.com';

export async function retell(method, path, body, { form } = {}) {
  const key = process.env.RETELL_API_KEY;
  if (!key) throw new Error('RETELL_API_KEY is not set. Create one at https://dashboard.retellai.com and add it to .env');
  const headers = { Authorization: `Bearer ${key}` };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`Retell ${method} ${path} failed (${res.status}): ${detail}`);
  }
  return data;
}

// List calls with the v3 endpoint and follow pagination.
export async function listCalls({ agentId, sinceMs, untilMs = Date.now(), max = 5000 } = {}) {
  const filter = {};
  if (agentId) filter.agent = [{ agent_id: agentId }];
  if (sinceMs) filter.start_timestamp = { type: 'range', op: 'bt', value: [sinceMs, untilMs] };
  const out = [];
  let pagination_key;
  do {
    const body = { filter_criteria: filter, limit: 1000, sort_order: 'descending' };
    if (pagination_key) body.pagination_key = pagination_key;
    const page = await retell('POST', '/v3/list-calls', body);
    out.push(...(page.items || []));
    pagination_key = page.has_more ? page.pagination_key : undefined;
  } while (pagination_key && out.length < max);
  return out.slice(0, max);
}

export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

export function daysAgoMs(days) {
  return Date.now() - Number(days) * 24 * 60 * 60 * 1000;
}
