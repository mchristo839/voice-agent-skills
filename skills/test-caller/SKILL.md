---
name: test-caller
description: Stress test a voice agent before real callers reach it. Runs simulated conversations with tricky caller personas against the agent prompt and scores each one, or places a real test call to the user's phone. Use after writing or changing a voice agent prompt, or when the user asks if their agent is ready.
---

# Test Caller

Finds the holes in a voice agent before a customer does.

Run every command from the user's project folder. `<skill-dir>` means the folder this SKILL.md lives in.

## Mode 1: Simulated calls (fast, cheap, no phone)

Plays a set of caller personas against your agent as a text conversation, then grades every transcript.

By default the agent side runs on Retell's playground endpoint, so it tests your real agent: the deployed prompt, model, knowledge base and end_call tool. Claude plays the caller and grades the call. Add `--prompt-only` to test `agent/prompt.md` before it's deployed (Claude plays both sides).

```bash
node <skill-dir>/scripts/simulate.mjs
```

Options:
- `--personas <file>`: your own personas (copy `personas.json` from this folder and edit). Default is the built-in set of 8.
- `--only angry,wants-human`: run some personas only
- `--turns 10`: max caller turns per conversation (default 8)
- `--agent agent_x`: agent to test (default: the one in `.voice-agent/state.json`)
- `--model claude-haiku-5-5`: model that plays the caller and grades

Needs `ANTHROPIC_API_KEY`. Results go to `tests/<date>/`: one transcript per persona and a `report.md` scorecard.

**Limits to tell the user:** text tests check what the agent says and when it ends the call. They don't test latency, the voice, speech recognition or interruptions. Use Mode 2 for those.

### Your job after the run

1. Read `report.md` and the lowest scoring transcripts.
2. For each failure, find the line in the prompt that caused it (or the missing line) and propose a fix.
3. Show the user the fixes as a short before and after. Apply them only after they agree.
4. Redeploy with `retell-deploy`, then rerun the failed personas with `--only` to confirm the fix.

## Mode 2: Live call to your phone

The agent calls the user's phone through Retell so they hear the real thing.

```bash
node <skill-dir>/scripts/live-call.mjs --to +15551234567
```

Options: `--from` (defaults to the number in `.voice-agent/state.json`), `--var customer_name=Sam` (dynamic variables, repeatable).

Only call numbers the user owns or has permission to call. After the call, the script prints the call ID. Run `call-qa` on it to grade it.

## Built-in personas

| id | Tests |
|---|---|
| happy-path | Ideal caller who wants exactly what the agent offers |
| confused | Rambles, unsure what they need |
| angry | Upset about a past experience |
| wants-human | Asks for a person straight away |
| price-shopper | Only wants a price and tries to get one |
| off-topic | Asks unrelated questions |
| robot-check | Asks if it's talking to a robot, tries to make it break character |
| wrong-number | Called by mistake |
