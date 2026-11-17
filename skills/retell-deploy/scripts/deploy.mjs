#!/usr/bin/env node
// Create or update a Retell LLM + agent from agent/prompt.md and agent/agent.json.
// Usage: node deploy.mjs [--dir agent] [--dry-run]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { retell, arg } from './_retell.mjs';

const dir = arg('dir', 'agent');
const dry = arg('dry-run', false) === true;
const statePath = '.voice-agent/state.json';

const need = p => { if (!existsSync(p)) { console.error(`Missing ${p}`); process.exit(1); } return readFileSync(p, 'utf8'); };
const cfg = JSON.parse(need(join(dir, 'agent.json')));
const prompt = need(join(dir, 'prompt.md'));
const beginPath = join(dir, 'begin_message.txt');
const begin = existsSync(beginPath) ? readFileSync(beginPath, 'utf8').trim() : null;
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};

const tools = [{
  type: 'end_call', name: 'end_call',
  description: 'End the call once the goal is done, the caller says goodbye, or it is a wrong number or voicemail.'
}];
if (cfg.transfer_number) tools.push({
  type: 'transfer_call', name: 'transfer_to_team',
  description: 'Transfer the caller to a human on the team when they ask for a person or need something you cannot handle.',
  transfer_destination: { type: 'predefined', number: cfg.transfer_number },
  // Cold transfer works everywhere. Switch to warm transfer in the dashboard if you want a handover summary.
  transfer_option: { type: 'cold_transfer', cold_transfer_mode: 'sip_invite' }
});

const llmBody = {
  general_prompt: prompt,
  begin_message: begin,
  general_tools: tools,
  model_config: {
    type: 'cascading',
    primary: { model: cfg.model || 'gpt-5.4-mini' },
    temperature: cfg.temperature ?? 0.2
  }
};
if (cfg.dynamic_variables) llmBody.default_dynamic_variables = cfg.dynamic_variables;
const kbIds = [...new Set([...(cfg.knowledge_base_ids || []), ...(state.knowledge_base_ids || [])])];
if (kbIds.length) llmBody.knowledge_base_ids = kbIds;

const agentBody = {
  agent_name: cfg.name,
  voice_id: cfg.voice_id,
  language: cfg.language || 'en-US'
};
if (cfg.webhook_url) agentBody.webhook_url = cfg.webhook_url;
if (cfg.post_call_analysis?.length) agentBody.post_call_analysis_data = cfg.post_call_analysis;

if (dry) {
  console.log('LLM payload:\n' + JSON.stringify(llmBody, null, 2));
  console.log('\nAgent payload:\n' + JSON.stringify(agentBody, null, 2));
  console.log(`\nWould ${state.agent_id ? 'update' : 'create'} agent. Nothing sent.`);
  process.exit(0);
}

let llmId = state.llm_id;
if (llmId) {
  await retell('PATCH', `/update-retell-llm/${llmId}`, llmBody);
  console.log(`Updated LLM ${llmId}`);
} else {
  const llm = await retell('POST', '/create-retell-llm', llmBody);
  llmId = llm.llm_id;
  console.log(`Created LLM ${llmId}`);
}

let agentId = state.agent_id;
if (agentId) {
  await retell('PATCH', `/update-agent/${agentId}`, agentBody);
  console.log(`Updated agent ${agentId}`);
} else {
  const agent = await retell('POST', '/create-agent', { ...agentBody, response_engine: { type: 'retell-llm', llm_id: llmId } });
  agentId = agent.agent_id;
  console.log(`Created agent ${agentId}`);
}

mkdirSync('.voice-agent', { recursive: true });
writeFileSync(statePath, JSON.stringify({ ...state, llm_id: llmId, agent_id: agentId, last_deploy: new Date().toISOString() }, null, 2));
console.log(`\nSaved IDs to ${statePath}`);
console.log(`Open it: https://dashboard.retellai.com/agents/${agentId}`);
console.log('Next: run test-caller, then number-connect.');
