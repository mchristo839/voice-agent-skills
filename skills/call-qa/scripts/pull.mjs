#!/usr/bin/env node
// Pull Retell call transcripts to markdown for QA.
// Usage: node pull.mjs [--days 7] [--limit 50] [--agent agent_x] [--min-seconds 20] [--out calls]
//        node pull.mjs --call call_abc123
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { retell, listCalls, arg, daysAgoMs } from './_retell.mjs';

const state = existsSync('.voice-agent/state.json') ? JSON.parse(readFileSync('.voice-agent/state.json', 'utf8')) : {};
const out = arg('out', 'calls');
const single = arg('call');
const minSec = Number(arg('min-seconds', 0));
mkdirSync(out, { recursive: true });

let ids;
if (single) ids = [single];
else {
  const agentId = arg('agent', state.agent_id);
  const calls = await listCalls({ agentId, sinceMs: daysAgoMs(arg('days', 7)), max: Number(arg('limit', 50)) * 2 });
  ids = calls
    .filter(c => c.call_status === 'ended' && (c.duration_ms || 0) / 1000 >= minSec)
    .slice(0, Number(arg('limit', 50)))
    .map(c => c.call_id);
}

if (!ids.length) { console.log('No calls found for that range.'); process.exit(0); }

for (const id of ids) {
  const c = await retell('GET', `/v2/get-call/${id}`);
  const a = c.call_analysis || {};
  const lines = [
    `# ${id}`,
    '',
    `- Date: ${c.start_timestamp ? new Date(c.start_timestamp).toISOString() : '?'}`,
    `- Direction: ${c.direction || '?'} (${c.from_number || '?'} to ${c.to_number || '?'})`,
    `- Length: ${Math.round((c.duration_ms || 0) / 1000)}s`,
    `- Ended because: ${c.disconnection_reason || '?'}`,
    `- Cost: ${c.call_cost?.combined_cost != null ? '$' + (c.call_cost.combined_cost / 100).toFixed(3) : '?'}`,
    `- Retell says successful: ${a.call_successful ?? '?'}, sentiment: ${a.user_sentiment ?? '?'}`,
    a.call_summary ? `- Summary: ${a.call_summary}` : null,
    a.custom_analysis_data ? `- Extracted: ${JSON.stringify(a.custom_analysis_data)}` : null,
    '',
    '## Transcript',
    '',
    (c.transcript_object || []).length
      ? c.transcript_object.map((u, i) => `${i + 1}. ${u.role === 'agent' ? 'Agent' : 'Caller'}: ${u.content}`).join('\n')
      : (c.transcript || '(no transcript)')
  ].filter(l => l !== null);
  writeFileSync(join(out, `${id}.md`), lines.join('\n') + '\n');
  console.log(`saved ${join(out, id)}.md`);
}
console.log(`\n${ids.length} calls in ./${out}. Grade them with rubric.md.`);
