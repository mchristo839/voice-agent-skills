#!/usr/bin/env node
// Retell webhook receiver that texts the caller after each analysed call.
// Run:  node server.mjs [--port 8787] [--templates agent/sms-templates.json] [--dry-run]
// Test: node server.mjs --test call_abc123 [--dry-run]
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { retell, arg } from './_retell.mjs';

const port = Number(arg('port', process.env.PORT || 8787));
const dry = arg('dry-run', false) === true;
const tplPath = arg('templates', existsSync('agent/sms-templates.json') ? 'agent/sms-templates.json' : new URL('../templates.json', import.meta.url).pathname);
const cfg = JSON.parse(readFileSync(tplPath, 'utf8'));
const sentPath = '.voice-agent/sms-sent.json';
const optoutPath = 'agent/sms-optouts.txt';

function loadSent() { return existsSync(sentPath) ? JSON.parse(readFileSync(sentPath, 'utf8')) : {}; }
function optedOut(num) {
  if (!existsSync(optoutPath)) return false;
  return readFileSync(optoutPath, 'utf8').split('\n').map(s => s.trim()).includes(num);
}

function pick(call) {
  const a = call.call_analysis || {};
  const custom = a.custom_analysis_data || {};
  const secs = (call.duration_ms || 0) / 1000;
  const early = ['voicemail_reached', 'dial_no_answer', 'dial_busy', 'dial_failed'].includes(call.disconnection_reason);
  if (custom.booked === true || custom.booked === 'true') return 'booked';
  if (secs < (cfg.min_seconds_for_real_call ?? 30) || early) return 'missed';
  return 'not_booked';
}

function fill(text, call) {
  const custom = call.call_analysis?.custom_analysis_data || {};
  const vars = {
    business_name: cfg.business_name, booking_link: cfg.booking_link,
    ...(call.retell_llm_dynamic_variables || {}), ...custom
  };
  if (!vars.caller_name) vars.caller_name = vars.customer_name || 'there';
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '').replace(/\s+/g, ' ').trim();
}

async function sendSms(to, body) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, SMS_FROM: from } = process.env;
  if (!sid || !token || !from) throw new Error('Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and SMS_FROM in .env');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: body })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio SMS failed (${res.status}): ${data.message}`);
  return data.sid;
}

async function handle(call) {
  const sent = loadSent();
  if (sent[call.call_id]) return `skip ${call.call_id}: already texted`;
  const custom = call.call_analysis?.custom_analysis_data || {};
  const to = custom.callback_number && /^\+\d{8,15}$/.test(custom.callback_number)
    ? custom.callback_number
    : (call.direction === 'outbound' ? call.to_number : call.from_number);
  if (!to || !/^\+\d{8,15}$/.test(to)) return `skip ${call.call_id}: no valid number`;
  if (optedOut(to)) return `skip ${call.call_id}: ${to} opted out`;
  const key = pick(call);
  const body = fill(cfg.templates[key], call);
  if (dry) return `[dry run] ${key} to ${to}: ${body}`;
  const sid = await sendSms(to, body);
  mkdirSync('.voice-agent', { recursive: true });
  writeFileSync(sentPath, JSON.stringify({ ...sent, [call.call_id]: { to, key, sid, at: new Date().toISOString() } }, null, 2));
  return `sent ${key} to ${to} (${sid})`;
}

// Test mode: run one real call through the logic
if (arg('test')) {
  const call = await retell('GET', `/v2/get-call/${arg('test')}`);
  console.log(await handle(call));
  process.exit(0);
}

const TOKEN = process.env.WEBHOOK_TOKEN;
if (!TOKEN) { console.error('Set WEBHOOK_TOKEN in .env so random people cannot trigger texts.'); process.exit(1); }

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method !== 'POST' || url.pathname !== '/retell') { res.writeHead(404).end(); return; }
  if (url.searchParams.get('token') !== TOKEN) { res.writeHead(401).end(); return; }
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 5e6) req.destroy(); });
  req.on('end', async () => {
    res.writeHead(204).end(); // answer Retell fast, work after
    try {
      const { event, call } = JSON.parse(raw);
      if (event !== 'call_analyzed' || !call) return;
      console.log(new Date().toISOString(), await handle(call));
    } catch (e) { console.error(new Date().toISOString(), 'error:', e.message); }
  });
}).listen(port, () => console.log(`SMS follow-up listening on :${port}/retell${dry ? ' (dry run)' : ''}`));
