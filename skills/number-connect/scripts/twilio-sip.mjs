#!/usr/bin/env node
// Buy (or reuse) a Twilio number in any country, wire it to Retell over an elastic SIP trunk,
// and import it into Retell with the agent bound.
//
// Search:  node twilio-sip.mjs --country GB [--type local|mobile|tollfree] [--contains 20]
// Buy:     node twilio-sip.mjs --buy +442071234567 [--bundle BUxxx] [--address ADxxx]
// Reuse:   node twilio-sip.mjs --use +442071234567
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { retell, arg } from './_retell.mjs';

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
if (!SID || !TOKEN) { console.error('Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env'); process.exit(1); }

const API = `https://api.twilio.com/2010-04-01/Accounts/${SID}`;
const TRUNKING = 'https://trunking.twilio.com/v1';
// Retell's SIP server. Check docs.retellai.com (Twilio SIP trunk guide) if Retell changes it.
const RETELL_SIP = process.env.RETELL_SIP_URI || 'sip:sip.retellai.com';

async function tw(method, url, params) {
  const opts = { method, headers: { Authorization: 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64') } };
  if (params && method !== 'GET') {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = new URLSearchParams(params).toString();
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio ${method} ${url.replace(SID, 'ACxxx')} failed (${res.status}): ${data.message || JSON.stringify(data)}`);
  return data;
}

const statePath = '.voice-agent/state.json';
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
const agentId = arg('agent', state.agent_id);
const buyNum = arg('buy');
const useNum = arg('use');

// Search mode
if (!buyNum && !useNum) {
  const country = String(arg('country', 'US')).toUpperCase();
  const type = { local: 'Local', mobile: 'Mobile', tollfree: 'TollFree' }[arg('type', 'local')] || 'Local';
  const q = new URLSearchParams({ VoiceEnabled: 'true', PageSize: '10' });
  if (arg('contains')) q.set('Contains', arg('contains'));
  const r = await tw('GET', `${API}/AvailablePhoneNumbers/${country}/${type}.json?${q}`);
  const list = r.available_phone_numbers || [];
  if (!list.length) { console.log(`No ${type} voice numbers found in ${country}. Try --type mobile or another --contains.`); process.exit(0); }
  for (const n of list) console.log(`${n.phone_number.padEnd(16)} ${(n.locality || n.region || '').padEnd(20)} ${n.address_requirements !== 'none' ? 'needs address/bundle' : ''}`);
  console.log(`\nPick one and rerun with --buy +NUMBER. Twilio charges a monthly fee per number.`);
  process.exit(0);
}

if (!agentId) { console.error('No agent ID. Run retell-deploy first or pass --agent agent_xxx'); process.exit(1); }

// 1. Get the number SID (buy or look up)
let numberSid, phone;
if (buyNum) {
  const params = { PhoneNumber: buyNum, FriendlyName: 'Retell voice agent' };
  if (arg('bundle')) params.BundleSid = arg('bundle');
  if (arg('address')) params.AddressSid = arg('address');
  const n = await tw('POST', `${API}/IncomingPhoneNumbers.json`, params);
  numberSid = n.sid; phone = n.phone_number;
  console.log(`Bought ${phone}`);
} else {
  const r = await tw('GET', `${API}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(useNum)}`);
  const n = (r.incoming_phone_numbers || [])[0];
  if (!n) { console.error(`${useNum} is not in this Twilio account.`); process.exit(1); }
  numberSid = n.sid; phone = n.phone_number;
  console.log(`Using existing number ${phone}`);
}

// 2. Elastic SIP trunk
const tag = randomBytes(4).toString('hex');
const domain = `retell-${tag}.pstn.twilio.com`;
const trunk = await tw('POST', `${TRUNKING}/Trunks`, { FriendlyName: `Retell ${phone}`, DomainName: domain });
console.log(`Created SIP trunk ${trunk.sid} (${domain})`);

// 3. Origination: inbound calls go to Retell
await tw('POST', `${TRUNKING}/Trunks/${trunk.sid}/OriginationUrls`, {
  FriendlyName: 'Retell', SipUrl: RETELL_SIP, Priority: '10', Weight: '10', Enabled: 'true'
});
console.log(`Origination set to ${RETELL_SIP}`);

// 4. Termination credentials: lets Retell place outbound calls through the trunk
const username = `retell${tag}`;
const password = 'Rt' + randomBytes(12).toString('base64url').replace(/[^A-Za-z0-9]/g, '') + '9a';
const cl = await tw('POST', `${API}/SIP/CredentialLists.json`, { FriendlyName: `Retell ${tag}` });
await tw('POST', `${API}/SIP/CredentialLists/${cl.sid}/Credentials.json`, { Username: username, Password: password });
await tw('POST', `${TRUNKING}/Trunks/${trunk.sid}/CredentialLists`, { CredentialListSid: cl.sid });
console.log('Termination credentials created');

// 5. Attach the number to the trunk
await tw('POST', `${TRUNKING}/Trunks/${trunk.sid}/PhoneNumbers`, { PhoneNumberSid: numberSid });
console.log(`Attached ${phone} to trunk`);

// 6. Import into Retell and bind the agent
await retell('POST', '/import-phone-number', {
  phone_number: phone,
  termination_uri: domain,
  sip_trunk_auth_username: username,
  sip_trunk_auth_password: password,
  inbound_agents: [{ agent_id: agentId, weight: 1 }],
  outbound_agents: [{ agent_id: agentId, weight: 1 }],
  nickname: `Twilio ${phone}`
});
console.log(`Imported ${phone} into Retell with agent ${agentId}`);

mkdirSync('.voice-agent', { recursive: true });
writeFileSync(statePath, JSON.stringify({ ...state, phone_number: phone, twilio_trunk_sid: trunk.sid }, null, 2));
console.log(`\nDone. Call ${phone} to hear your agent. The SIP password lives in Twilio and Retell only, it is not saved locally.`);
