---
name: retell-deploy
description: Create or update a Retell voice agent from the terminal using a prompt file and a small JSON config. Use when the user wants to ship, redeploy or change the voice, model, prompt, tools or knowledge base of a Retell AI phone agent.
---

# Retell Deploy

Ships a voice agent to Retell from files in the project. Running it again updates the same agent, so the prompt lives in git and Retell stays in sync.

Run every command from the user's project folder. `<skill-dir>` means the folder this SKILL.md lives in.

## Files it reads

- `agent/prompt.md`: the prompt (write it with `voice-prompt-writer`)
- `agent/begin_message.txt`: first thing the agent says (optional, empty file means the agent waits for the caller)
- `agent/agent.json`: settings. Copy `example.agent.json` from this folder if it doesn't exist.
- `.voice-agent/state.json`: IDs from earlier runs (created for you)

## Steps

1. Check `RETELL_API_KEY` is set (env or `.env`). If not, tell the user to create one at dashboard.retellai.com.
2. If the user hasn't picked a voice, list them and suggest two or three that fit the caller's accent:
   ```bash
   node <skill-dir>/scripts/voices.mjs --accent American --gender female
   ```
3. Fill in `agent/agent.json`. Ask the user for the transfer number and webhook URL if they want them.
4. Deploy:
   ```bash
   node <skill-dir>/scripts/deploy.mjs
   ```
   First run creates a Retell LLM and an agent. Later runs update both. Add `--dry-run` to print the payloads without calling Retell.
5. Tell the user the agent ID and the dashboard link the script prints. They can test it in the browser straight away with the dashboard's web call button.

## agent.json fields

| Field | What it does |
|---|---|
| `name` | Agent name in the dashboard |
| `voice_id` | e.g. `retell-Cimo`. Use `voices.mjs` to find one |
| `language` | e.g. `en-US`, `en-AU`, `en-GB` |
| `model` | LLM model, e.g. `gpt-5.4-mini`, `claude-5.5-haiku` |
| `temperature` | 0 to 1, keep it low (0 to 0.3) for phone agents |
| `transfer_number` | E.164 number for live transfer. Leave empty for none |
| `webhook_url` | Where Retell posts call events (used by `sms-follow-up`) |
| `dynamic_variables` | Default values for `{{variables}}` in the prompt |
| `post_call_analysis` | Fields Retell extracts after each call (used by `call-report`) |

## Rules

- Never paste the API key into files that get committed. `.env` goes in `.gitignore`.
- Model names change often. If Retell rejects the model, run `--dry-run`, check Retell's docs for current names and update `agent.json`.
- After any prompt change, run `test-caller` before sending real traffic.
