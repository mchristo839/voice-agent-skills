#!/usr/bin/env node
// Voice Agent MCP server: lets any MCP client (Claude, Cursor, Codex...) create, test and review Retell voice agents.
// Needs RETELL_API_KEY in the environment.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { retell, listCalls, daysAgoMs } from './_retell.mjs';

const server = new McpServer({ name: 'voice-agent', version: '0.1.0' });
const ok = data => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });
const wrap = fn => async args => {
  try { return ok(await fn(args)); }
  catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
};

server.tool('list_agents', 'List all Retell voice agents with their IDs, names and voices.', {},
  wrap(async () => {
    const out = [];
    let pagination_key;
    do {
      const q = new URLSearchParams({ limit: '1000' });
      if (pagination_key) q.set('pagination_key', pagination_key);
      const r = await retell('POST', `/v2/list-agents?${q}`, {});
      out.push(...(r.items || []));
      pagination_key = r.has_more ? r.pagination_key : undefined;
    } while (pagination_key);
    return out.map(a => ({ agent_id: a.agent_id, name: a.agent_name, voice: a.voice_name || a.voice_id, engine: a.response_engine_type, published_version: a.latest_published_version }));
  }));

server.tool('get_agent', 'Get one agent, including its full prompt.', { agent_id: z.string() },
  wrap(async ({ agent_id }) => {
    const agent = await retell('GET', `/get-agent/${agent_id}`);
    const llmId = agent.response_engine?.llm_id;
    const llm = llmId ? await retell('GET', `/get-retell-llm/${llmId}`) : null;
    return { agent, prompt: llm?.general_prompt, begin_message: llm?.begin_message, model_config: llm?.model_config };
  }));

server.tool('update_prompt', 'Replace the prompt (and optionally the first message) of an agent built on a Retell LLM.',
  { agent_id: z.string(), prompt: z.string().min(20), begin_message: z.string().optional() },
  wrap(async ({ agent_id, prompt, begin_message }) => {
    const agent = await retell('GET', `/get-agent/${agent_id}`);
    const llmId = agent.response_engine?.llm_id;
    if (!llmId) throw new Error('This agent does not use a Retell LLM, so its prompt cannot be updated here.');
    const body = { general_prompt: prompt };
    if (begin_message !== undefined) body.begin_message = begin_message;
    await retell('PATCH', `/update-retell-llm/${llmId}`, body);
    return `Prompt updated on LLM ${llmId} for agent ${agent_id}.`;
  }));

server.tool('list_voices', 'List available voices, optionally filtered by accent or gender.',
  { accent: z.string().optional(), gender: z.enum(['male', 'female']).optional() },
  wrap(async ({ accent, gender }) => (await retell('GET', '/list-voices'))
    .filter(v => (!accent || (v.accent || '').toLowerCase().includes(accent.toLowerCase())) && (!gender || v.gender === gender))
    .map(v => ({ voice_id: v.voice_id, name: v.voice_name, gender: v.gender, accent: v.accent, provider: v.provider }))));

server.tool('list_calls', 'List recent calls for an agent with status, length, cost and outcome. No transcripts (use get_call).',
  { agent_id: z.string().optional(), days: z.number().min(1).max(90).default(7), limit: z.number().min(1).max(500).default(50) },
  wrap(async ({ agent_id, days, limit }) => (await listCalls({ agentId: agent_id, sinceMs: daysAgoMs(days), max: limit })).map(c => ({
    call_id: c.call_id, start: c.start_timestamp ? new Date(c.start_timestamp).toISOString() : null,
    status: c.call_status, direction: c.direction, seconds: Math.round((c.duration_ms || 0) / 1000),
    ended_because: c.disconnection_reason, cost_usd: c.call_cost?.combined_cost != null ? c.call_cost.combined_cost / 100 : null,
    successful: c.call_analysis?.call_successful, sentiment: c.call_analysis?.user_sentiment,
    extracted: c.call_analysis?.custom_analysis_data
  }))));

server.tool('get_call', 'Get one call with its transcript and post-call analysis.', { call_id: z.string() },
  wrap(async ({ call_id }) => {
    const c = await retell('GET', `/v2/get-call/${call_id}`);
    return {
      call_id: c.call_id, agent_id: c.agent_id, seconds: Math.round((c.duration_ms || 0) / 1000),
      ended_because: c.disconnection_reason, analysis: c.call_analysis,
      cost_usd: c.call_cost?.combined_cost != null ? c.call_cost.combined_cost / 100 : null,
      transcript: c.transcript
    };
  }));

server.tool('call_stats', 'Headline numbers for an agent over a period: calls, bookings, success rate, minutes, cost.',
  { agent_id: z.string().optional(), days: z.number().min(1).max(90).default(7), booked_field: z.string().default('booked') },
  wrap(async ({ agent_id, days, booked_field }) => {
    const calls = (await listCalls({ agentId: agent_id, sinceMs: daysAgoMs(days) })).filter(c => c.call_status === 'ended');
    const cost = calls.reduce((s, c) => s + (c.call_cost?.combined_cost || 0), 0) / 100;
    const booked = calls.filter(c => [true, 'true'].includes(c.call_analysis?.custom_analysis_data?.[booked_field])).length;
    const mins = calls.reduce((s, c) => s + (c.duration_ms || 0), 0) / 60000;
    return {
      days, calls: calls.length, booked, minutes: +mins.toFixed(1),
      success_rate: calls.length ? +(calls.filter(c => c.call_analysis?.call_successful).length / calls.length).toFixed(2) : 0,
      cost_usd: +cost.toFixed(2), cost_per_booking_usd: booked ? +(cost / booked).toFixed(2) : null
    };
  }));

server.tool('test_agent_turn', 'Send a text conversation to an agent and get its next reply, using Retell\'s playground. Runs the real agent (prompt, model, tools) with no phone call. Messages use role agent or user.',
  { agent_id: z.string(), messages: z.array(z.object({ role: z.enum(['agent', 'user']), content: z.string() })).min(1) },
  wrap(async ({ agent_id, messages }) => {
    const r = await retell('POST', `/agent-playground-completion/${agent_id}`, { messages });
    return { reply: (r.messages || []).filter(m => m.role === 'agent').map(m => m.content).join(' '), tool_calls: (r.messages || []).filter(m => m.role === 'tool_call_invocation').map(m => m.name), call_ended: r.call_ended };
  }));

server.tool('create_test_call', 'Have an agent call a phone number. Only call numbers the user owns or has consent to call.',
  { from_number: z.string().regex(/^\+\d{8,15}$/), to_number: z.string().regex(/^\+\d{8,15}$/), agent_id: z.string().optional(),
    dynamic_variables: z.record(z.string()).optional() },
  wrap(async ({ from_number, to_number, agent_id, dynamic_variables }) => {
    const body = { from_number, to_number, metadata: { source: 'voice-agent-mcp' } };
    if (agent_id) body.override_agent_id = agent_id;
    if (dynamic_variables) body.retell_llm_dynamic_variables = dynamic_variables;
    const c = await retell('POST', '/v2/create-phone-call', body);
    return `Calling ${to_number}. Call ID: ${c.call_id}`;
  }));

server.tool('list_phone_numbers', 'List phone numbers in the Retell account and which agents they point to.', {},
  wrap(async () => { const r = await retell('GET', '/v2/list-phone-numbers'); return (Array.isArray(r) ? r : r.items || []).map(n => ({
    phone_number: n.phone_number, nickname: n.nickname, inbound_agents: n.inbound_agents, outbound_agents: n.outbound_agents
  })); }));

await server.connect(new StdioServerTransport());
