#!/usr/bin/env node
// Have the Retell agent call your own phone.
// Usage: node live-call.mjs --to +15551234567 [--from +1...] [--agent agent_x] [--var name=value ...]
import { readFileSync, existsSync } from 'node:fs';
import { retell, arg } from './_retell.mjs';

const state = existsSync('.voice-agent/state.json') ? JSON.parse(readFileSync('.voice-agent/state.json', 'utf8')) : {};
const to = arg('to');
const from = arg('from', state.phone_number);
const agentId = arg('agent', state.agent_id);

if (!to || !/^\+\d{8,15}$/.test(to)) { console.error('Pass --to in E.164 format, e.g. +15551234567'); process.exit(1); }
if (!from) { console.error('No from number. Run number-connect first or pass --from'); process.exit(1); }

const vars = {};
process.argv.forEach((a, i) => {
  if (a === '--var' && process.argv[i + 1]) {
    const [k, ...v] = process.argv[i + 1].split('=');
    vars[k] = v.join('=');
  }
});

const body = { from_number: from, to_number: to, metadata: { source: 'test-caller' } };
if (agentId) body.override_agent_id = agentId;
if (Object.keys(vars).length) body.retell_llm_dynamic_variables = vars;

const call = await retell('POST', '/v2/create-phone-call', body);
console.log(`Calling ${to} from ${from}. Call ID: ${call.call_id}`);
console.log('After you hang up, grade it with call-qa:');
console.log(`  node <call-qa skill dir>/scripts/pull.mjs --call ${call.call_id}`);
