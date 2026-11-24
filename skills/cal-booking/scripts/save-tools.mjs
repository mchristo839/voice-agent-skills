#!/usr/bin/env node
// Copy the integration tools you added in the Retell dashboard into agent/agent.json,
// so the next retell-deploy run keeps them instead of wiping them.
// Usage: node save-tools.mjs [--dir agent] [--check]
//   --check  only report what's on the agent, don't write anything
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { retell, arg } from './_retell.mjs';

const dir = arg('dir', 'agent');
const checkOnly = arg('check', false) === true;
const statePath = '.voice-agent/state.json';
const cfgPath = join(dir, 'agent.json');

const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
if (!state.llm_id) {
  console.error(`No llm_id in ${statePath}. Deploy the agent with retell-deploy first.`);
  process.exit(1);
}

const llm = await retell('GET', `/get-retell-llm/${state.llm_id}`);
const tools = [
  ...(llm.general_tools || []),
  ...(llm.states || []).flatMap(s => s.tools || [])
];

const legacy = tools.filter(t => ['check_availability_cal', 'book_appointment_cal'].includes(t.type));
if (legacy.length) {
  console.log(`Found ${legacy.length} old built-in Cal.com tool(s). Retell no longer lets you edit these.`);
  console.log('Add the Cal.com integration tools in the dashboard, delete the old ones, then run this again.\n');
}

const integration = (llm.general_tools || []).filter(t => t.type === 'integration_app');
const calTools = integration.filter(t => /calcom/i.test(t.app_tool_template_name || ''));
const has = name => calTools.some(t => t.app_tool_template_name === name);

console.log(`Integration tools on LLM ${state.llm_id}:`);
if (!integration.length) console.log('  none');
for (const t of integration) {
  const pinned = (t.parameters || []).flatMap(p => Object.entries(p.properties || {}))
    .filter(([, v]) => v && v.const !== undefined).map(([k, v]) => `${k}=${v.const}`);
  console.log(`  ${t.name}  (${t.provider} / ${t.app_tool_template_name})${pinned.length ? '  ' + pinned.join(', ') : ''}`);
}

const missing = ['check_calcom_availability', 'book_calcom_appointment'].filter(n => !has(n));
if (missing.length) {
  console.log(`\nMissing: ${missing.join(', ')}. Add them in the agent's Functions section (+ Add > your Cal.com connection).`);
}
if (state.calcom_app_id && calTools.some(t => t.app_id !== state.calcom_app_id)) {
  console.log(`\nNote: some Cal.com tools use a different connection than calcom_app_id in ${statePath}.`);
}

if (checkOnly) process.exit(missing.length ? 2 : 0);
if (!integration.length) {
  console.log('\nNothing to save.');
  process.exit(missing.length ? 2 : 0);
}
if (!existsSync(cfgPath)) {
  console.error(`\nMissing ${cfgPath}. Run retell-deploy first.`);
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const others = (cfg.extra_tools || []).filter(t => t.type !== 'integration_app');
cfg.extra_tools = [...others, ...integration];
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
console.log(`\nSaved ${integration.length} tool(s) to extra_tools in ${cfgPath}. retell-deploy will keep them from now on.`);
