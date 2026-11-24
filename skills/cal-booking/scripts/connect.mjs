#!/usr/bin/env node
// Connect Cal.com to your Retell workspace with an API key, so agents can use Retell's Cal.com tools.
// Usage: node connect.mjs [--dry-run] [--name "Cal.com - API key"] [--provider <name>]
// Reuses a Cal.com connection that already exists. Saves its id to .voice-agent/state.json as calcom_app_id.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { retell, arg } from './_retell.mjs';
import { calDomain } from './_cal.mjs';

const dry = arg('dry-run', false) === true;
const name = arg('name', 'Cal.com - API key');
const statePath = '.voice-agent/state.json';
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
const isCal = s => typeof s === 'string' && /cal[\s._-]?com|^cal$|calcom/i.test(s);

const listOf = res => Array.isArray(res) ? res : (res?.items || res?.templates || res?.apps || []);

// Find the provider name Retell uses for Cal.com, unless the user passed one.
async function findProvider() {
  const given = arg('provider');
  if (given && given !== true) return given;
  const templates = listOf(await retell('GET', '/list-app-templates'));
  const hit = templates.find(t => isCal(t.provider) || isCal(t.display_name) || isCal(t.name));
  if (!hit?.provider) {
    throw new Error('Could not find Cal.com in Retell\'s app catalog. Connect it in the dashboard (Integrations > Cal.com) or pass --provider.');
  }
  return hit.provider;
}

// Reuse an existing Cal.com connection if there is one.
const apps = listOf(await retell('GET', '/list-apps?limit=1000'));
const existing = apps.find(a => isCal(a.provider) && (!state.calcom_app_id || a.app_id === state.calcom_app_id))
  || apps.find(a => isCal(a.provider));

let appId;
if (existing) {
  appId = existing.app_id;
  console.log(`Found Cal.com connection "${existing.name || appId}" (${existing.connection_status || 'status unknown'}). Reusing it.`);
} else {
  const key = process.env.CAL_API_KEY;
  if (!key && !dry) {
    console.error('No Cal.com connection yet and CAL_API_KEY is not set.');
    console.error('Either add CAL_API_KEY to .env, or connect with OAuth in the Retell dashboard (Integrations > Cal.com) and run this again.');
    process.exit(1);
  }
  const provider = await findProvider();
  const body = {
    type: 'calendar',
    provider,
    name,
    tenant_url: calDomain(),
    auth_config: { type: 'api_key', api_key: key || '<CAL_API_KEY>' }
  };
  if (dry) {
    const shown = { ...body, auth_config: { type: 'api_key', api_key: '***' } };
    console.log('Would create this connection:\n' + JSON.stringify(shown, null, 2));
    console.log('\nNothing sent.');
    process.exit(0);
  }
  const app = await retell('POST', '/create-app', body);
  appId = app.app_id;
  console.log(`Created Cal.com connection ${appId} (${calDomain()}).`);
}

if (dry) {
  console.log(`\nWould check the connection's credentials and save calcom_app_id=${appId}. Nothing sent.`);
  process.exit(0);
}

// Save the id first, so a rerun finds this connection even if the sign-in check fails.
mkdirSync('.voice-agent', { recursive: true });
writeFileSync(statePath, JSON.stringify({ ...state, calcom_app_id: appId }, null, 2));
console.log(`Saved calcom_app_id to ${statePath}`);

const test = await retell('POST', `/test-app-auth/${appId}`);
if (test?.success === false) {
  console.error('\nRetell could not sign in to Cal.com with this connection.');
  console.error('Check the key has not expired and that the domain (cal.com or cal.eu) matches where you made it.');
  console.error('Fix it in the dashboard: Integrations > Connected > this connection > Reconnect. Then run this again.');
  process.exit(1);
}
console.log('Retell signed in to Cal.com.');
console.log('\nNext: add Check Availability and Book Appointment to the agent in the dashboard, then run save-tools.mjs.');
if (state.agent_id) console.log(`Open the agent: https://dashboard.retellai.com/agents/${state.agent_id}`);
