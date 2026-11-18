# How skills in this repo are built

Every skill follows these rules. The weekly automated build follows them too.

## Shape

- One folder per skill: `skills/<name>/` with a `SKILL.md`, and a `scripts/` folder only if the skill needs to run code.
- `SKILL.md` starts with frontmatter: `name` (matches the folder) and `description` (what it does, then "Use when..."). Keep the description under 400 characters.
- Commands in `SKILL.md` use `<skill-dir>` for the skill's own folder and run from the user's project folder.
- Scripts are plain Node 18+ `.mjs` files with **no dependencies**. Copy `mcp/_retell.mjs` into the skill's `scripts/` folder as `_retell.mjs` when you call Retell.
- Shared state lives in `.voice-agent/state.json` in the user's project (`agent_id`, `llm_id`, `phone_number`, `knowledge_base_ids`). Read it, never overwrite other keys.
- Every script that spends money or contacts real people (buys numbers, places calls, sends texts) does a dry run first and needs an explicit flag (`--buy`, `--send`, `--yes`) to act.
- Secrets come from the environment or `.env`. Add any new variables to `.env.example` with an empty value.

## Writing

- Plain English, active voice, short sentences. Write like you're explaining it to a smart friend.
- No em dashes, no semicolons, no hype words (cutting-edge, seamless, robust, leverage, unlock, supercharge, game-changer, and the like).
- Say what the skill doesn't do and what can go wrong.
- Include the legal basics when a skill contacts people: consent, opt-out, calling hours.

## Privacy

- No real client names, real phone numbers, real people, API keys, account IDs or private data, anywhere.
- Example businesses are made up. Example phone numbers use reserved fictional ranges: US `+1 512 555 01xx`, UK `+44 20 7946 0xxx`.
- Commits use the GitHub no-reply email.

## Testing

- `node --check` every script.
- Run each script against a local mock of the APIs it calls before shipping. Never test against real customer accounts.
- Add the skill to the table in `README.md` and tick it off in `ROADMAP.md`.
