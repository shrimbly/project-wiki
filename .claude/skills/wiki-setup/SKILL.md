---
name: wiki-setup
description: First-time interactive bootstrap of a fresh project-wiki. Use when the operating manual still has {{PLACEHOLDER}} values, when the user says "set up the wiki / start a new project / initialize this", or before any other wiki skill on a brand-new copy. Captures what the project is, who it's for, and any starting material; fills in the manuals and viewer branding; seeds the wiki; and ingests initial references.
metadata:
  internal: true
---

# wiki-setup

Bootstrap a brand-new project-wiki. This is interactive — you are gathering the
project's identity and starting material, then writing it into the repo. Read
`CLAUDE.md` first so you know the conventions you're filling in.

## 1. Check state

- If `CLAUDE.md` no longer contains `{{` placeholders, the project is already set
  up. Confirm with the user before re-running (it will overwrite the Project
  block, the seed wiki pages, and viewer branding).
- `ls annotations/*.json 2>/dev/null` and read any non-empty ones — unlikely on a
  fresh repo, but check.

## 2. Gather the essentials (interactive)

Collect these. Use `AskUserQuestion` for anything with discrete choices; ask for
free-text descriptions conversationally. Don't over-ask — infer sensible defaults
and confirm rather than interrogating.

1. **Project name** — short title (e.g. "Comfy UI Information Architecture").
2. **One-paragraph description** — what this project is exploring. This becomes
   the heart of `wiki/overview.md`, so get it in the user's words.
3. **Deliverable(s)** — what the wiki should ultimately produce (a written doc, a
   diagram, a decision record, a Notion handoff…). Offer common options.
4. **Audience** — who reads the output (eng, design, product, leadership, mixed).
5. **Owner** — name/email if the user wants it recorded (default: the git user).
6. **Starting material** — does the user have references to ingest right now?
   Links, files, pasted notes, meeting transcripts, "none yet." Collect whatever
   they offer; you'll ingest it in step 5.

Also derive:
- **Slug** — a kebab-case form of the project name, for `{{PROJECT_SLUG}}`.
- **Viewer title / subtitle** — title = project name (or a short form); subtitle =
  a 3–5 word descriptor.

## 3. Write the identity into the repo

- **`CLAUDE.md`** — replace `{{PROJECT_NAME}}`, `{{PROJECT_DESCRIPTION}}`,
  `{{PROJECT_DELIVERABLE}}`, `{{PROJECT_AUDIENCE}}`, `{{PROJECT_OWNER}}`,
  `{{PROJECT_SLUG}}`.
- **`AGENTS.md`** — replace `{{PROJECT_NAME}}`.
- **`README.md`** — replace the top `# project-wiki` heading + lead paragraph with
  the real project name and a one-line description. Leave the rest (it documents
  the kit, which is still accurate).
- **`viewer/src/lib/site.config.ts`** — set `title` and `subtitle`.

## 4. Seed the wiki

Rewrite the placeholder seed pages with real starting content:

- **`wiki/overview.md`** — `## Summary` paragraph from the description; a `## What
  we're modeling` / `## Current shape` scaffold with honest "TBD as sources land"
  notes. `status: living`.
- **`wiki/open-questions.md`** — leave the structure; seed it with any genuine
  unknowns the user already named.
- **`wiki/index.md`** — keep the catalog skeleton; it'll grow as pages are added.
- **`sources/INDEX.md`** — leave the "no sources yet" note unless step 5 adds some.

Don't pre-create empty `entities/` `concepts/` `decisions/` dirs — they're made on
first use by `wiki-ingest` / `wiki-research`.

## 5. Ingest any starting material

For each reference the user provided, run the **`wiki-ingest`** procedure (invoke
`/wiki-ingest` or follow `.claude/skills/wiki-ingest/SKILL.md`). If they gave
several, ingest them one at a time so each gets a clean capture + fan-out.

If they said "none yet," skip — that's normal.

## 6. Log + commit + hand off

- Append a `## [YYYY-MM-DD] setup | <project name>` entry to `log.md` noting what
  was captured and any initial sources ingested.
- Commit (and push if a remote is configured).
- Tell the user how to continue: run the viewer (`cd viewer && npm run dev`, open
  `http://localhost:4321/`), feed material with `/wiki-ingest`, deepen with
  `/wiki-research`. Mention they can highlight-and-comment in the viewer to give
  feedback.
