---
name: voice-prompt-writer
description: Write a production voice agent prompt from a business website, notes or an existing prompt. Use when the user wants to create, rewrite or tighten the prompt for an AI phone agent (receptionist, booking, lead qualification, lead reactivation, support) on Retell, Vapi, ElevenLabs or any voice platform.
---

# Voice Prompt Writer

Turns a business into a voice agent prompt that sounds human on the phone and stays on task.

## What you need from the user

Ask only for what you can't find yourself:

1. The business website URL (or pasted notes)
2. The agent's one job: answer inbound calls, book appointments, qualify leads, call old leads back, or support
3. What counts as a win (booked call, captured name and number, transfer to a human)
4. Where to transfer when the caller needs a person, and business hours
5. Agent name and the caller's likely language and accent

If they give a URL, read the site yourself (home, services, pricing, FAQ, contact, about). Pull out services, prices, service area, hours, booking rules and common objections.

## How to write it

Use `template.md` in this folder as the structure. Fill every section. Then apply these rules:

- **Write for the ear.** Short sentences. No lists, markdown, URLs or emoji in what the agent says. Spell numbers the way people say them ("nine to five", "two hundred dollars").
- **One question at a time.** The agent asks one thing, waits, then moves on.
- **Keep replies short.** Two sentences max per turn. Go longer only when the caller asks for detail.
- **Name the win.** The prompt states the goal of the call in one line near the top.
- **Give an exit for every dead end.** Wrong number, angry caller, wants a human, asks something the agent doesn't know, asks if it's a robot, voicemail.
- **Never invent facts.** If the answer isn't in the prompt or knowledge base, the agent says it will have someone follow up.
- **Be honest about being AI.** If asked, the agent says it's an AI assistant for the business.
- **Use dynamic variables** for anything per call, written as `{{customer_name}}`, `{{course_name}}`, `{{current_time}}`. List them at the top so the deploy step can set defaults.
- **Keep facts out of the prompt when there are many.** Put long price lists, FAQs and policies in the knowledge base (see the `kb-builder` skill) and tell the agent to use it.

## Output

Save to `agent/prompt.md` and a short begin message to `agent/begin_message.txt`.

Then print a summary for the user:
- the agent's goal in one line
- the dynamic variables it expects
- the open questions you had to guess (mark each one so the user can fix it)

## Checks before you finish

Read the prompt out loud in your head as a caller. Fix anything that:
- would take more than 10 seconds to say
- uses words nobody says on the phone ("utilize", "regarding", "please be advised")
- asks two questions in one turn
- leaves the agent with nothing to say when the caller goes off script

Next step for the user: run `kb-builder` for the knowledge base, then `retell-deploy`.
