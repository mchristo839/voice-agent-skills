# Voice Agent Skills

Build, test and run AI phone agents from your terminal. These are free, open source skills for Claude Code, Codex, Cursor and OpenClaw.

I build production voice agents for businesses. These skills are the workflow I use, packaged so you can ship your own voice agent this week.

Built by [Mario Lucas](https://mariolucas.com/skills). Runs on [Retell](https://www.retellai.com) and [Twilio](https://www.twilio.com).

## What's inside

| # | Skill | What it does |
|---|---|---|
| 1 | [voice-prompt-writer](skills/voice-prompt-writer) | Website in, agent prompt out. Written for the ear, with every dead end handled |
| 2 | [kb-builder](skills/kb-builder) | Crawls your site, cleans it and uploads it as the agent's knowledge base |
| 3 | [retell-deploy](skills/retell-deploy) | Creates or updates the agent from files, so your prompt lives in git |
| 4 | [number-connect](skills/number-connect) | Gives it a real phone number. US/CA through Retell, any country through Twilio SIP |
| 5 | [test-caller](skills/test-caller) | Throws 8 difficult callers at your live agent and scores every call. Or the agent calls your phone |
| 6 | [call-qa](skills/call-qa) | Pulls real transcripts and grades them against a 10 point rubric |
| 7 | [sms-follow-up](skills/sms-follow-up) | Texts every caller after the call: booked, not booked or missed |
| 8 | [call-report](skills/call-report) | Weekly report with bookings, cost per booking and the trend |
| 9 | [cost-calc](skills/cost-calc) | Real per-minute cost on Retell, Vapi and ElevenLabs, plus what to charge a client |

There's also an **MCP server** in [`mcp/`](mcp) so any agent can list, test, update and report on your voice agents directly.

## The 30 minute build

Open your AI coding agent in an empty folder and say:

> Build me a voice agent for https://my-business.com that books appointments.

The skills take it from there, in this order:

1. `voice-prompt-writer` reads your site and writes `agent/prompt.md`
2. `kb-builder` turns your site into a knowledge base
3. `test-caller` runs 8 difficult callers against the prompt and fixes what breaks
4. `retell-deploy` ships it to Retell
5. `number-connect` gets it a phone number
6. Call it.

Then, every week: `call-qa` to find what's going wrong, `call-report` to show what it's making you.

See [`examples/harbour-lane-plumbing`](examples/harbour-lane-plumbing) for a full example agent and the two bugs `test-caller` caught before launch.

## Install

### Claude Code (plugin)

```
/plugin marketplace add mchristo839/voice-agent-skills
/plugin install voice-agent-skills@voice-agent-skills
```

### Claude Code, Codex, Cursor, OpenClaw (copy the skills)

```bash
git clone https://github.com/mchristo839/voice-agent-skills
cd voice-agent-skills
./install.sh claude      # or: codex, cursor, openclaw, all
```

`install.sh` copies the skill folders to the place each tool reads skills from (`~/.claude/skills`, `~/.codex/skills`, `~/.cursor/skills`, `~/.openclaw/skills`). If your version of a tool reads them from somewhere else, copy the `skills/` folders there yourself. Each skill is a plain folder with a `SKILL.md`, so any agent that reads that format can use it.

### MCP server

```bash
cd mcp && npm install
claude mcp add voice-agent -e RETELL_API_KEY=key_xxx -- node "$(pwd)/server.mjs"
```

For Cursor, Codex or Claude Desktop, add the same command (`node /path/to/mcp/server.mjs`) with `RETELL_API_KEY` in its env to your MCP config.

Tools: `list_agents`, `get_agent`, `update_prompt`, `test_agent_turn`, `list_voices`, `list_calls`, `get_call`, `call_stats`, `create_test_call`, `list_phone_numbers`.

## What you need

- Node 18 or newer
- A [Retell](https://dashboard.retellai.com) API key
- A [Twilio](https://console.twilio.com) account for international numbers and SMS (optional)
- An [Anthropic](https://console.anthropic.com) API key for simulated test calls (optional)

Copy `.env.example` to `.env` in your project and fill it in. Never commit it.

## What it costs to run

Retell runs at roughly $0.07 to $0.31 a minute depending on the model and voice, before phone costs. Run `cost-calc` for your own numbers. The skills are free.

## Play it safe

- Outbound AI calls and texts need consent in most countries (TCPA in the US, Spam Act and DNC in Australia, PECR in the UK). Check before you dial.
- Your agent should say it's an AI when asked. The prompt template does this by default.
- Keep call transcripts out of git. They hold real customer data.

## More from me

- **[Voice Agent QA Kit](https://mariolucas.com/qa-kit):** 30 test callers plus industry packs, regression baselines and a branded report you can send to clients.
- **[Free Launch Kit](https://mariolucas.com/#kit):** a build guide, prompt templates, n8n workflows, 30 awkward test calls and the calling rules for the US, UK, Australia and EU.
- **[Build notes](https://mariolucas.com/#notes):** what breaks when voice agents meet real customers, and what fixed it.
- **[X](https://x.com/mariolucasai) and [YouTube](https://www.youtube.com/@mariolucasai):** new skills land there first.

## License

MIT. Use it, fork it, sell what you build with it.
