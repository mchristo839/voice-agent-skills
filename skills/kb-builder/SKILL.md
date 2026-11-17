---
name: kb-builder
description: Turn a business website, PDFs or notes into a clean knowledge base for a voice agent and upload it to Retell. Use when the user wants their voice agent to answer questions about services, prices, policies or FAQs from their own content.
---

# KB Builder

Builds a knowledge base the agent can search during calls, then uploads it to Retell.

Run every command from the user's project folder. `<skill-dir>` means the folder this SKILL.md lives in.

## Steps

1. **Crawl the site** (skip if the user only has files):
   ```bash
   node <skill-dir>/scripts/crawl.mjs --url https://example.com --max 40 --out kb
   ```
   It reads the sitemap (or follows links on the same domain), strips menus and scripts, and writes one markdown file per page into `kb/`.

2. **Add files.** Copy any PDFs, price lists or FAQ docs the user gives you into `kb/`. Convert them to markdown when you can, since plain text chunks better.

3. **Clean it up yourself.** Open the files in `kb/` and:
   - delete pages with no useful facts (blog fluff, legal boilerplate, careers, cookie pages)
   - remove repeated headers, footers and nav text
   - rewrite tables as short sentences ("The standard clean costs one hundred and fifty dollars and takes about an hour.")
   - add an `faq.md` with the 10 to 20 questions callers ask most, answered in one or two spoken sentences each
   - flag anything that looks out of date and ask the user

4. **Upload to Retell:**
   ```bash
   node <skill-dir>/scripts/upload.mjs --name "Acme Plumbing KB" --dir kb
   ```
   Add `--urls https://example.com/pricing,https://example.com/faq --refresh` to also let Retell scrape live pages and refresh them daily.
   The script prints the `knowledge_base_id` and saves it to `.voice-agent/state.json`.

5. **Attach it.** `retell-deploy` picks up the ID from the state file automatically. Tell the user that's the next step.

## Rules

- Knowledge base names must be under 40 characters.
- Retell takes up to 25 files per knowledge base, 50 MB each.
- Facts the agent needs on every call (hours, service area, the goal) belong in the prompt. The knowledge base is for lookups.
- Never upload customer data, call recordings or anything private.

## Requirements

- Node 18+
- `RETELL_API_KEY` in the environment or a `.env` file
