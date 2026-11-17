---
name: cost-calc
description: Compare what a voice agent costs per minute, per call and per month on Retell, Vapi and ElevenLabs, and work out a price to charge clients with a target margin. Use when the user asks what a voice agent will cost, which platform is cheaper, or how to price a voice agent for a client.
---

# Cost Calc

Shows the real all-in cost of a voice agent on each platform, so nobody gets surprised by the bill.

Run every command from the user's project folder. `<skill-dir>` means the folder this SKILL.md lives in.

## Run it

```bash
node <skill-dir>/scripts/calc.mjs --calls 1000 --avg-min 3
```
Options:
- `--minutes 3000` instead of `--calls` and `--avg-min`
- `--llm 0.02`: LLM cost per minute for the model you picked (big models cost a lot more than small ones)
- `--telephony 0.014`: phone cost per minute if you bring your own Twilio or SIP
- `--margin 60`: target margin %, prints a price per minute and a monthly retainer to charge
- `--rates <file>`: your own copy of `rates.json`

## Before you trust the numbers

Voice platforms change prices often. `rates.json` in this folder has a `checked` date and links to each pricing page.

1. If `checked` is older than 60 days, open the pricing pages (links in `rates.json`), update the rates and the date.
2. Lines marked `assumed` in the output are typical values, not published prices. Ask the user for their real LLM model and phone provider and pass `--llm` and `--telephony`.
3. Say clearly in your answer which numbers are published and which are assumed.

## What it leaves out

Monthly phone number rental, concurrency add-ons, HIPAA or compliance add-ons, premium voices, SMS, and your own build and support time. Mention the ones that apply to the user.

## Pricing a client

With `--margin`, the script prints a per-minute price and a monthly retainer. Remind the user that most small business buyers prefer a flat monthly fee with a minute allowance over per-minute billing, and that the value is in bookings, not minutes. `call-report --value` shows the client their return.
