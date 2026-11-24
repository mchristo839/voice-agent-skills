// Tiny Cal.com API v2 client. No dependencies. Node 18+.
// Reads CAL_API_KEY (and optional CAL_BASE_URL) from the environment or .env.
import './_retell.mjs'; // loads .env

export const CAL_BASE = process.env.CAL_BASE_URL || 'https://api.cal.com';

// Each Cal.com v2 endpoint pins its own version header. These are the values Cal.com's docs ask for.
export const VERSIONS = {
  eventTypes: '2026-06-12',
  slots: '2024-09-04'
};

export async function cal(path, { version, query } = {}) {
  const key = process.env.CAL_API_KEY;
  if (!key) throw new Error('CAL_API_KEY is not set. Create one in Cal.com under Settings > Developer > API keys and add it to .env');
  const url = new URL(CAL_BASE + path);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== '') url.searchParams.set(k, v);
  const headers = { Authorization: `Bearer ${key}` };
  if (version) headers['cal-api-version'] = version;
  const res = await fetch(url, { headers });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data?.error || data);
    throw new Error(`Cal.com GET ${path} failed (${res.status}): ${detail}`);
  }
  return data;
}

// "cal.eu" when the base URL points at the EU instance, otherwise "cal.com".
export function calDomain() {
  return /cal\.eu/i.test(CAL_BASE) ? 'cal.eu' : 'cal.com';
}
