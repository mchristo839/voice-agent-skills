---
name: number-connect
description: Give a Retell voice agent a real phone number, either bought through Retell (US and Canada) or bought in Twilio for any country and wired in over an elastic SIP trunk. Use when the user wants their voice agent to take or make real phone calls.
---

# Number Connect

Gets the agent a real phone number and points it at the agent.

Run every command from the user's project folder. `<skill-dir>` means the folder this SKILL.md lives in. Both scripts read the agent ID from `.voice-agent/state.json` (created by `retell-deploy`), or take `--agent agent_xxx`.

**Buying a number costs money.** Both scripts only search until the user confirms the exact number, then you rerun with `--buy`. Always show the user the number and ask before buying.

## Pick a route

| The user needs | Route |
|---|---|
| A US or Canadian number, fastest setup | A: Retell number |
| Any other country (UK, Australia, Cyprus...) or they already have a Twilio number | B: Twilio over SIP |

## Route A: Retell number (US and CA)

```bash
node <skill-dir>/scripts/retell-number.mjs --area 415            # shows what it will buy
node <skill-dir>/scripts/retell-number.mjs --area 415 --buy      # buys it and binds the agent
```
Options: `--country CA`, `--toll-free`, `--nickname "Main line"`.

## Route B: Twilio number over SIP (any country)

Needs `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in `.env`.

1. Search:
   ```bash
   node <skill-dir>/scripts/twilio-sip.mjs --country GB --type local
   ```
   Options: `--type local|mobile|tollfree`, `--contains 20` (digits the number should contain).
2. Ask the user which number they want, then buy and wire it:
   ```bash
   node <skill-dir>/scripts/twilio-sip.mjs --buy +442079460123
   ```
3. Already own the Twilio number? Skip buying:
   ```bash
   node <skill-dir>/scripts/twilio-sip.mjs --use +442079460123
   ```

The script creates an elastic SIP trunk, points origination at Retell, sets up credentials for outbound calls, attaches the number and imports it into Retell with the agent bound for inbound and outbound.

## Things that trip people up

- **Regulated countries.** Australia, the UK, Germany and many others need an address or a regulatory bundle before Twilio sells a number. If Twilio returns a bundle or address error, tell the user to create one in the Twilio console (Phone Numbers > Regulatory Compliance), then rerun with `--bundle BUxxx` and/or `--address ADxxx`.
- **Toll-free numbers over SIP** need TCP. Set `RETELL_SIP_URI="sip:sip.retellai.com;transport=tcp"` in `.env` before running Route B.
- **Outbound over your own trunk fails?** Some new Retell accounts need outbound SIP turned on. Check the Retell community or ask their support with a failed call ID.
- **Outbound calls from Retell numbers** only reach US numbers. Use Route B for calling other countries.
- **Caller ID and spam labels.** New numbers making lots of outbound calls get flagged. Register the number with the carrier's branded caller ID or STIR/SHAKEN programme before a big campaign.
- **Consent.** Outbound AI calls to people who didn't opt in are illegal in many places (TCPA in the US, Spam Act and DNC in Australia, PECR in the UK). Check before you dial.

## After it's connected

Call the number from your phone. Then run `test-caller --live` to have the agent call you.
