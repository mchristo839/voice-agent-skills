#!/usr/bin/env node
// Voice agent performance report from Retell call data.
// Usage: node report.mjs [--days 7 | --from YYYY-MM-DD --to YYYY-MM-DD] [--agent agent_x]
//        [--booked-field booked] [--value 250] [--currency USD] [--json]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { listCalls, arg } from './_retell.mjs';

const state = existsSync('.voice-agent/state.json') ? JSON.parse(readFileSync('.voice-agent/state.json', 'utf8')) : {};
const agentId = arg('agent', state.agent_id);
const field = arg('booked-field', 'booked');
const value = arg('value') ? Number(arg('value')) : null;
const cur = arg('currency', 'USD');
const asJson = arg('json', false) === true;

const DAY = 864e5;
let to = arg('to') ? new Date(arg('to') + 'T23:59:59').getTime() : Date.now();
let from = arg('from') ? new Date(arg('from') + 'T00:00:00').getTime() : to - Number(arg('days', 7)) * DAY;
const span = to - from;

function stats(calls) {
  const ended = calls.filter(c => c.call_status === 'ended');
  const connected = ended.filter(c => (c.duration_ms || 0) >= 10000);
  const mins = ended.reduce((s, c) => s + (c.duration_ms || 0), 0) / 60000;
  const cost = ended.reduce((s, c) => s + (c.call_cost?.combined_cost || 0), 0) / 100;
  const booked = ended.filter(c => { const v = c.call_analysis?.custom_analysis_data?.[field]; return v === true || v === 'true'; }).length;
  const success = ended.filter(c => c.call_analysis?.call_successful === true).length;
  const count = (arr, fn) => arr.reduce((m, c) => { const k = fn(c) ?? 'unknown'; m[k] = (m[k] || 0) + 1; return m; }, {});
  const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]);
  return {
    calls: ended.length,
    connected: connected.length,
    minutes: +mins.toFixed(1),
    avg_seconds: ended.length ? Math.round(mins * 60 / ended.length) : 0,
    booked,
    booking_rate: connected.length ? booked / connected.length : 0,
    success_rate: ended.length ? success / ended.length : 0,
    sentiment: count(ended, c => c.call_analysis?.user_sentiment),
    ended_because: top(count(ended, c => c.disconnection_reason)).slice(0, 5),
    busiest_hours: top(count(ended, c => c.start_timestamp ? new Date(c.start_timestamp).getHours() : null)).slice(0, 3),
    cost: +cost.toFixed(2),
    cost_per_call: ended.length ? +(cost / ended.length).toFixed(2) : 0,
    cost_per_booking: booked ? +(cost / booked).toFixed(2) : null,
    revenue: value != null ? booked * value : null,
    roi: value != null && cost > 0 ? +((booked * value) / cost).toFixed(1) : null
  };
}

const [now, prev] = await Promise.all([
  listCalls({ agentId, sinceMs: from, untilMs: to }),
  listCalls({ agentId, sinceMs: from - span, untilMs: from })
]);
const a = stats(now), b = stats(prev);

if (asJson) { console.log(JSON.stringify({ agent_id: agentId, from, to, current: a, previous: b }, null, 2)); process.exit(0); }

const d = t => new Date(t).toISOString().slice(0, 10);
const pct = x => (x * 100).toFixed(0) + '%';
const money = x => x == null ? '-' : `${cur} ${x.toFixed(2)}`;
const delta = (x, y) => y ? ` (${x >= y ? '+' : ''}${(((x - y) / y) * 100).toFixed(0)}% vs last period)` : '';

let md = `# Voice agent report\n\n${d(from)} to ${d(to)}${agentId ? `, agent ${agentId}` : ''}\n\n`;
md += `## What we changed / what's next\n\n_(fill in: one win, one problem, one action)_\n\n`;
md += `## Headline numbers\n\n| | This period | Last period |\n|---|---|---|\n`;
md += `| Calls | ${a.calls} | ${b.calls} |\n| Connected (10s+) | ${a.connected} | ${b.connected} |\n`;
md += `| Bookings | ${a.booked} | ${b.booked} |\n| Booking rate | ${pct(a.booking_rate)} | ${pct(b.booking_rate)} |\n`;
md += `| Successful (Retell) | ${pct(a.success_rate)} | ${pct(b.success_rate)} |\n`;
md += `| Minutes | ${a.minutes} | ${b.minutes} |\n| Avg length | ${a.avg_seconds}s | ${b.avg_seconds}s |\n`;
md += `| Total cost | ${money(a.cost)} | ${money(b.cost)} |\n| Cost per call | ${money(a.cost_per_call)} | ${money(b.cost_per_call)} |\n`;
md += `| Cost per booking | ${money(a.cost_per_booking)} | ${money(b.cost_per_booking)} |\n`;
if (value != null) md += `| Est. revenue | ${money(a.revenue)} | ${money(b.revenue)} |\n| Return on spend | ${a.roi != null ? a.roi + 'x' : '-'} | ${b.roi != null ? b.roi + 'x' : '-'} |\n`;
if (b.booked) md += `\nBookings${delta(a.booked, b.booked)}.\n`;
md += `\n## Caller sentiment\n\n` + (Object.entries(a.sentiment).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '- no data') + '\n';
md += `\n## Why calls ended\n\n` + (a.ended_because.map(([k, v]) => `- ${k}: ${v}`).join('\n') || '- no data') + '\n';
md += `\n## Busiest hours\n\n` + (a.busiest_hours.map(([h, v]) => `- ${String(h).padStart(2, '0')}:00: ${v} calls`).join('\n') || '- no data') + '\n';
if (a.calls < 20) md += `\n_Small sample (${a.calls} calls). Treat the trends as early signals._\n`;

mkdirSync('reports', { recursive: true });
const file = `reports/call-report-${d(from)}-to-${d(to)}.md`;
writeFileSync(file, md);
console.log(md + `\nSaved ${file}`);
