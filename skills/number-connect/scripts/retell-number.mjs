#!/usr/bin/env node
// Buy a US/CA number through Retell and bind the agent to it.
// Usage: node retell-number.mjs --area 415 [--country CA] [--toll-free] [--nickname "Main"] [--agent agent_x] [--buy]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { retell, arg } from './_retell.mjs';

const statePath = '.voice-agent/state.json';
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
const agentId = arg('agent', state.agent_id);
const area = arg('area');
const country = arg('country', 'US');
const tollFree = arg('toll-free', false) === true;
const nickname = arg('nickname', 'Voice agent line');
const buy = arg('buy', false) === true;

if (!agentId) { console.error('No agent ID. Run retell-deploy first or pass --agent agent_xxx'); process.exit(1); }
if (!area && !tollFree) { console.error('Pass --area 415 (3 digit US/CA area code) or --toll-free'); process.exit(1); }

const body = {
  country_code: country,
  nickname,
  inbound_agents: [{ agent_id: agentId, weight: 1 }],
  outbound_agents: [{ agent_id: agentId, weight: 1 }]
};
if (area) body.area_code = Number(area);
if (tollFree) body.toll_free = true;

if (!buy) {
  console.log('This will buy a Retell number with:\n' + JSON.stringify(body, null, 2));
  console.log('\nRetell charges a monthly fee per number. Rerun with --buy to confirm.');
  process.exit(0);
}

const num = await retell('POST', '/create-phone-number', body);
console.log(`Bought ${num.phone_number} and bound agent ${agentId} (inbound and outbound).`);
mkdirSync('.voice-agent', { recursive: true });
writeFileSync(statePath, JSON.stringify({ ...state, phone_number: num.phone_number }, null, 2));
console.log(`Saved to ${statePath}. Call it now to hear your agent.`);
