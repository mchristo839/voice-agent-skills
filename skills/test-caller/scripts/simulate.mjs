#!/usr/bin/env node
// Simulate caller personas against a voice agent prompt and grade each conversation.
// Usage: node simulate.mjs [--agent agent_x] [--prompt-only] [--prompt agent/prompt.md] [--personas file.json] [--only a,b] [--turns 8] [--model claude-haiku-5-5]
// By default the agent side runs on Retell's playground endpoint (your real agent, model and tools).
// --prompt-only plays the agent from agent/prompt.md with Claude instead (no Retell agent needed).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arg, loadEnv, retell } from './_retell.mjs';

loadEnv();
const here = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('Set ANTHROPIC_API_KEY in .env'); process.exit(1); }

const model = arg('model', process.env.TEST_CALLER_MODEL || 'claude-haiku-5-5');
const promptPath = arg('prompt', 'agent/prompt.md');
const beginPath = join(dirname(promptPath), 'begin_message.txt');
const personasPath = arg('personas', join(here, '..', 'personas.json'));
const only = arg('only') ? String(arg('only')).split(',') : null;
const maxTurns = Number(arg('turns', 8));
const state = existsSync('.voice-agent/state.json') ? JSON.parse(readFileSync('.voice-agent/state.json', 'utf8')) : {};
const agentId = arg('prompt-only', false) === true ? null : arg('agent', state.agent_id);

if (!agentId && !existsSync(promptPath)) { console.error(`No agent in .voice-agent/state.json and no prompt at ${promptPath}.`); process.exit(1); }
const agentPrompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf8') : '(prompt lives in Retell)';
console.log(agentId ? `Testing live agent ${agentId} via Retell playground` : `Testing ${promptPath} (prompt-only mode)`);
const begin = existsSync(beginPath) ? readFileSync(beginPath, 'utf8').trim() : '';
let personas = JSON.parse(readFileSync(personasPath, 'utf8'));
if (only) personas = personas.filter(p => only.includes(p.id));

async function claude(system, messages, maxTokens = 300) {
  const res = await fetch((process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic API error (${res.status}): ${JSON.stringify(data.error || data)}`);
  return data.content.map(c => c.text || '').join('').trim();
}

// Fill {{variables}} with placeholders so the model doesn't see raw braces.
const agentSystem = agentPrompt.replace(/\{\{(\w+)\}\}/g, (_, v) => v === 'current_time' ? new Date().toLocaleString() : `[${v}]`) +
  '\n\nYou are on a live phone call. Reply with only the words you would say out loud. When the call should end, say your goodbye and then write [END_CALL] on its own.';

const callerSystem = p => `You are role-playing a phone caller to test a business's AI phone agent.
Persona: ${p.persona}
Speak like a real person on the phone: short, natural, sometimes messy. Reply with only what you say out loud.
Stay in persona. When the call is clearly over (goodbye said, or you'd hang up), write [HANG_UP] on its own after your last line.`;

const graderSystem = `You grade AI phone agent calls. Be strict and specific. Return JSON only, no prose, with this shape:
{"score": 1-10, "passed": true|false, "goal_reached": true|false,
 "issues": [{"turn": n, "problem": "...", "prompt_fix": "the exact line to add or change in the agent prompt"}],
 "good": ["..."]}
Score against: pass condition, one question per turn, short spoken replies, no invented facts, honest about being AI, handled the dead end, ended cleanly.`;

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const outDir = join('tests', stamp);
mkdirSync(outDir, { recursive: true });
const results = [];

for (const p of personas) {
  process.stdout.write(`Testing ${p.id}... `);
  const transcript = [];
  const callerMsgs = [];
  let agentLine, agentEnded = false;
  // Retell side: full history as {role: agent|user, content}
  const history = [];
  async function agentTurn() {
    if (agentId) {
      const r = await retell('POST', `/agent-playground-completion/${agentId}`, { messages: history });
      const said = (r.messages || []).filter(m => m.role === 'agent').map(m => m.content).join(' ').trim();
      const ended = r.call_ended || (r.messages || []).some(m => m.role === 'tool_call_invocation' && m.type === 'end_call');
      return { said, ended };
    }
    const msgs = [{ role: 'user', content: '(The call connects.)' }];
    for (const h of history) msgs.push({ role: h.role === 'agent' ? 'assistant' : 'user', content: h.content });
    let out = await claude(agentSystem, msgs);
    const ended = out.includes('[END_CALL]');
    return { said: out.replace('[END_CALL]', '').trim(), ended };
  }
  ({ said: agentLine, ended: agentEnded } = begin ? { said: begin, ended: false } : await agentTurn());
  for (let t = 0; t < maxTurns; t++) {
    if (agentLine) { transcript.push({ who: 'Agent', text: agentLine }); history.push({ role: 'agent', content: agentLine }); }
    if (agentEnded) break;
    callerMsgs.push({ role: 'user', content: agentLine || '(silence)' });
    let callerLine = await claude(callerSystem(p), callerMsgs);
    const callerEnded = callerLine.includes('[HANG_UP]');
    callerLine = callerLine.replace('[HANG_UP]', '').trim();
    if (callerLine) { transcript.push({ who: 'Caller', text: callerLine }); history.push({ role: 'user', content: callerLine }); }
    if (callerEnded) break;
    callerMsgs.push({ role: 'assistant', content: callerLine || '...' });
    ({ said: agentLine, ended: agentEnded } = await agentTurn());
  }
  const text = transcript.map((l, i) => `${i + 1}. ${l.who}: ${l.text}`).join('\n');
  writeFileSync(join(outDir, `${p.id}.md`), `# ${p.id}\n\nPersona: ${p.persona}\nPass if: ${p.pass_if}\n\n${text}\n`);

  const raw = await claude(graderSystem, [{ role: 'user', content: `Agent prompt:\n${agentPrompt}\n\nPersona: ${p.persona}\nPass condition: ${p.pass_if}\n\nTranscript:\n${text}` }], 1200);
  let grade;
  try { grade = JSON.parse(raw.replace(/^```(json)?|```$/g, '').trim()); } catch { grade = { score: 0, passed: false, issues: [{ problem: 'Grader returned bad JSON: ' + raw.slice(0, 200) }] }; }
  results.push({ id: p.id, ...grade });
  console.log(`${grade.passed ? 'PASS' : 'FAIL'} ${grade.score}/10`);
}

const passed = results.filter(r => r.passed).length;
const avg = (results.reduce((s, r) => s + (r.score || 0), 0) / results.length).toFixed(1);
let md = `# Test caller report\n\nRun: ${stamp}\nModel: ${model}\nPassed: ${passed}/${results.length}\nAverage score: ${avg}/10\n\n| Persona | Result | Score |\n|---|---|---|\n`;
md += results.map(r => `| ${r.id} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.score} |`).join('\n') + '\n';
for (const r of results.filter(r => r.issues?.length)) {
  md += `\n## ${r.id}\n` + r.issues.map(i => `- Turn ${i.turn ?? '?'}: ${i.problem}${i.prompt_fix ? `\n  - Fix: ${i.prompt_fix}` : ''}`).join('\n') + '\n';
}
writeFileSync(join(outDir, 'report.md'), md);
console.log(`\n${passed}/${results.length} passed, average ${avg}/10. Report: ${join(outDir, 'report.md')}`);
