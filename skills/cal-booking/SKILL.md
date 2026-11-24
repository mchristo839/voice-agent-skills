---
name: cal-booking
description: Connect Cal.com to a Retell voice agent so it checks real availability and books appointments during the call, using Retell's Cal.com integration. Use when the user wants the agent to book, offer open times, or replace the old built-in Cal.com tools.
---

# Cal Booking

Lets the agent offer real open times from Cal.com and book one while the caller is still on the line. Cal.com sends the confirmation email and calendar invite, the same as a booking made on your booking page.

It uses Retell's Cal.com integration: one connection for the whole Retell workspace, plus two tools on the agent (Check Availability and Book Appointment). Retell's old built-in Cal.com tools (`check_availability_cal`, `book_appointment_cal`) stopped accepting changes on 30 September 2026, so don't copy setups that still use them.

Run every command from the user's project folder. `<skill-dir>` means the folder this SKILL.md lives in.

## What you need

- A Cal.com account on cal.com (or cal.eu) with one event type for the thing callers book, like "30 min quote visit". Cal.com now calls event types "links".
- That event type's calendar connected in Cal.com under Apps, so busy times are blocked.
- An agent already deployed with `retell-deploy`.
- `CAL_API_KEY` in `.env`. Create it in Cal.com under Settings > Developer > API keys. Turn on **Never expires**. An expiring key breaks booking mid-call on the day it lapses.
- For cal.eu accounts only, set `CAL_BASE_URL=https://api.cal.eu`.

## Steps

1. Find the event type and check it has openings:
   ```bash
   node <skill-dir>/scripts/cal-check.mjs --list
   node <skill-dir>/scripts/cal-check.mjs --event-type 123456 --days 7 --tz America/Chicago
   ```
   This only reads. If it shows no open slots, fix that in Cal.com first. Otherwise the agent tells every caller you're fully booked.
2. Connect Cal.com to Retell:
   ```bash
   node <skill-dir>/scripts/connect.mjs --dry-run
   node <skill-dir>/scripts/connect.mjs
   ```
   It reuses a Cal.com connection if the workspace already has one. Otherwise it creates one with the API key, checks Retell can sign in, and saves `calcom_app_id` to `.voice-agent/state.json`. Prefer OAuth? Connect in the dashboard under Integrations > Cal.com instead, then run `connect.mjs` to pick it up.
3. Add the two tools to the agent in the Retell dashboard. Retell's docs say this step is dashboard only for now.
   - Open the agent, go to **Functions**, click **+ Add**, pick your Cal.com connection.
   - Add **Check Availability**. Name it `check_availability`. Paste the event type ID and set the timezone (an IANA name like `America/Chicago`).
   - Add **Book Appointment**. Name it `book_appointment`. Same event type ID and timezone.
   - Click **Run a test** on Check Availability. Don't test Book Appointment with a real customer's details. It makes a real booking and sends real emails.
4. Save the tools into your project so the next deploy keeps them:
   ```bash
   node <skill-dir>/scripts/save-tools.mjs
   ```
   This copies the integration tools from the agent into `extra_tools` in `agent/agent.json`. Skip it and the next `retell-deploy` run removes them. Use `--check` to only look.
5. Add the booking rules to the prompt. Paste `booking-prompt.md` from this folder into `agent/prompt.md`, and add `business_timezone` to `dynamic_variables` in `agent/agent.json` (for example `"business_timezone": "Central Time"`).
6. Redeploy with `retell-deploy`, then run `test-caller`. Add a test caller who wants a time that isn't free, and one who changes their mind after hearing the read-back.

## What it doesn't do

- Reschedule or cancel. Retell's Cal.com integration has List Bookings, Reschedule Booking and Cancel Booking tools too. Add them the same way in step 3 if you want them. They find bookings by the caller's email.
- Team round-robin across several event types. Each tool is pinned to one event type. Add one pair of tools per event type.
- Self-hosted Cal.com. Retell only talks to cal.com and cal.eu.
- Set up conversation flow agents. Those add the tools in a Function node instead. The prompt rules still apply.

## What can go wrong

- **Empty availability.** The event type has no working hours in the window, its calendar isn't connected, or the minimum notice is longer than the window. Run `cal-check.mjs` to see what Cal.com returns.
- **Wrong times.** The timezone on the tool and the one in the prompt don't match. Set both to the business's timezone.
- **Booking fails with a conflict.** Someone took the slot between the check and the booking. The prompt tells the agent to check again and offer the next time.
- **Bad email.** Speech-to-text mangles email addresses. The prompt makes the agent read it back. Without a correct email, the caller never gets the confirmation.
- **Tools vanish after a deploy.** You skipped step 4. Add them again and run `save-tools.mjs`.
- **Tool calls time out.** Retell gives each integration call a few seconds. The prompt tells the agent to take a number and promise a callback after two failures.

## Rules

- Never put the Cal.com key in `agent.json` or anything else that gets committed. It belongs in `.env`. Retell stores it encrypted in the connection.
- Book only after the caller says yes to the read-back.
- The agent should tell the caller a confirmation email is coming, so a surprise invite doesn't look like spam.
- If you record calls or collect emails, say so in your privacy notice.
