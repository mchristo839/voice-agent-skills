---
name: call-report
description: Build a weekly (or any period) report for a Retell voice agent with calls, bookings, success rate, sentiment, why calls ended, cost per call and cost per booking. Use when the user wants voice agent stats, a weekly client report, ROI numbers or a performance summary.
---

# Call Report

Turns Retell call data into a report a business owner reads in two minutes.

Run every command from the user's project folder. `<skill-dir>` means the folder this SKILL.md lives in.

## Run it

```bash
node <skill-dir>/scripts/report.mjs --days 7
```
Options:
- `--agent agent_x` (default: the agent in `.voice-agent/state.json`)
- `--from 2026-11-01 --to 2026-11-08` instead of `--days`
- `--booked-field booked` (the post-call analysis field that means "won", default `booked`)
- `--value 250` (what one booking is worth, adds revenue and ROI lines)
- `--currency USD`
- `--json` (raw numbers for a dashboard or another tool)

Writes `reports/call-report-<from>-to-<to>.md` and prints it.

## What's in it

- Calls, connected calls, total minutes, average length
- Bookings and booking rate (from your `booked` field)
- Retell's success rate and sentiment split
- Top reasons calls ended
- Busiest hours
- Total cost, cost per call, cost per booking
- If `--value` is set: estimated revenue and return on spend
- The previous period side by side, so the user sees the trend

## Your job after the run

Add a short "What we changed / what's next" section at the top in plain words: one win, one problem, one action. Pull the problem from the data (for example, many calls ending with `user_hangup` under 20 seconds means the opening is weak) and suggest running `call-qa` on those calls.

Keep it honest. If the sample is small (under 20 calls), say so and don't call it a trend.

## Sending it every week

Ask the user if they want this on a schedule. Options: a cron job on their server, an n8n or Make workflow that runs the script and emails the markdown, or a scheduled task in their AI tool if it has one.
