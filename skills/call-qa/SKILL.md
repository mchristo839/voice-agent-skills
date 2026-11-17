---
name: call-qa
description: Pull real call transcripts from Retell and grade them against a QA rubric, then turn the failures into prompt fixes. Use when the user wants to review, audit or score their voice agent's real calls, find out why calls fail, or improve the agent from live data.
---

# Call QA

Grades real calls so you fix the prompt from evidence, not guesses.

Run every command from the user's project folder. `<skill-dir>` means the folder this SKILL.md lives in.

## 1. Pull the calls

```bash
node <skill-dir>/scripts/pull.mjs --days 7 --limit 50       # recent calls for the agent in state.json
node <skill-dir>/scripts/pull.mjs --call call_abc123         # one call
```
Options: `--agent agent_x`, `--min-seconds 20` (skip hang-ups and voicemail), `--out calls`.

Each call is saved as `calls/<call_id>.md` with the transcript, Retell's post-call analysis, duration, cost and why it ended.

## 2. Grade them

Use `rubric.md` in this folder (or the user's own if they have one). For each call file:

1. Read the transcript.
2. Score each rubric line 0, 1 or 2 and note the turn where it went wrong.
3. Give the call a total and a one line verdict.

Write the results to `calls/qa-report.md`:
- a table: call ID, date, length, score out of 20, verdict
- the three most common failures across all calls, with the count and one quoted example of each (short, under 15 words)
- for each common failure, the prompt change that would fix it

With more than 30 calls, grade a random sample of 30 and say so in the report.

## 3. Close the loop

Show the user the top fixes. After they agree, edit `agent/prompt.md`, run `test-caller` on the matching personas, then `retell-deploy`.

## Privacy

Transcripts contain real customer names and numbers. Keep `calls/` out of git (add it to `.gitignore`), never paste transcripts into public places, and delete the folder when the review is done if the user doesn't need it.
