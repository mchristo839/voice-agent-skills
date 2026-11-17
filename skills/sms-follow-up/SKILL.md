---
name: sms-follow-up
description: Text the caller automatically after a voice agent call, with a different message for booked, not booked and missed calls, using Retell's call webhook and Twilio SMS. Use when the user wants post-call SMS confirmations, follow-ups or recovery texts for their voice agent.
---

# SMS Follow-up

Sends the caller a text once Retell finishes analysing the call. Booked callers get a confirmation. Callers who didn't book get a nudge. Short or dropped calls get a "sorry we missed you".

Run every command from the user's project folder. `<skill-dir>` means the folder this SKILL.md lives in.

## Setup

1. Copy `templates.json` from this folder to `agent/sms-templates.json` and edit the wording with the user. Keep each text under 160 characters, include the business name, and keep the opt-out line.
2. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   SMS_FROM=+15551234567        # a Twilio number that can send SMS
   WEBHOOK_TOKEN=pick-a-long-random-string
   ```
3. Make sure `retell-deploy`'s `post_call_analysis` includes the `booked` field (the example config does).
4. Run the server:
   ```bash
   node <skill-dir>/scripts/server.mjs --port 8787
   ```
   Host it anywhere that runs Node (a VPS, Railway, Fly, Render) or put it behind a tunnel to test.
5. Set `webhook_url` in `agent/agent.json` to `https://your-host/retell?token=YOUR_WEBHOOK_TOKEN` and rerun `retell-deploy`.

Test without a webhook:
```bash
node <skill-dir>/scripts/server.mjs --test call_abc123 --dry-run
```
This loads a real call from Retell, picks the template and prints the text it would send.

## How it picks a template

| Template | When |
|---|---|
| `booked` | `booked` is true in Retell's analysis |
| `not_booked` | call lasted 30 seconds or more and `booked` is false |
| `missed` | call shorter than 30 seconds, voicemail, or the caller hung up early |

Template variables: `{{caller_name}}`, `{{business_name}}`, `{{booking_link}}`, plus anything in the call's dynamic variables or extracted analysis.

## Rules

- Only text people who called you or opted in. Follow the SMS rules where the caller lives (A2P 10DLC registration in the US, the Spam Act in Australia, PECR in the UK).
- Every text keeps an opt-out line. Numbers in `agent/sms-optouts.txt` (one per line) never get texts.
- One text per call. The server remembers call IDs it already handled in `.voice-agent/sms-sent.json`.
- Want the agent to text during the call instead (like a link while the caller is still on the line)? Retell has a built-in `send_sms` tool. Add it in the dashboard.
