---
name: wiki-publish
description: Publish the core of the wiki as Notion document(s). Use when the user wants to share findings out of the repo — a clean, audience-ready document or small set of documents describing the project's core concepts. This is deliberately NOT a 1:1 dump of every wiki page; it's a curated narrative synthesized from the wiki. Requires the Notion MCP and confirmation before creating anything.
---

# wiki-publish

Produce a curated, audience-ready document (or a small set) in Notion from the
wiki's core concepts. The output is a **synthesis for readers**, not an export of
the tree — most readers should never need to open the repo.

## 1. Decide what "core" means here

Read `wiki/index.md` and `wiki/overview.md`. Propose a **curated outline** — the
handful of concepts/entities/decisions that a reader genuinely needs, in a logical
reading order. Deliberately leave out: stubs, internal scaffolding, granular open
questions, anything `status: draft` that isn't load-bearing.

Confirm scope with the user via `AskUserQuestion`:

- **Shape** — a single "Core Concepts" document, or a small set (e.g. one per
  major area)? Recommend single unless the material is clearly too big.
- **Depth** — executive summary, or full narrative with the decisions and
  rationale? Match the audience recorded in `CLAUDE.md`.
- **Inclusions** — confirm the outline; let them add/drop sections.

## 2. Get the Notion destination

- Use the Notion MCP to locate a parent (search for a workspace/page), or ask the
  user to paste a parent page URL/ID.
- Check whether a previously-published version exists (see step 5's record). If so,
  default to **updating it in place** rather than creating a duplicate.
- **Confirm before writing.** Publishing is outward-facing — show the user the
  target location and the outline, and get an explicit go-ahead before creating or
  overwriting Notion content.

## 3. Compose the document(s)

Write for the reader, not as a wiki dump:

- Open with a tight overview (what this is, why it matters).
- One clean section per core concept/entity, in reading order. Explain; don't just
  transcribe the wiki page. Pull the decisions and their rationale in where they
  matter.
- Convert internal viewer-URL cross-links (`/wiki-entities-foo/`) into either
  Notion-internal links (if the referenced concept is its own published page) or
  plain prose references — never leave raw `/wiki-...` URLs in the output.
- Include a diagram if the wiki has one and Notion can render it (embed the mermaid
  or a rendered image).
- Keep it legible without the repo. Where useful, note "maintained in the
  project-wiki" so readers know the source of truth.

## 4. Create / update in Notion

Use the Notion MCP to create the page(s) under the chosen parent, or update the
existing published page(s). Verify each write succeeded and collect the resulting
URLs.

## 5. Record what was published where

So re-publishing can update in place, record the mapping:

- Add or update `wiki/references/published-docs.md` (or a clearly-named page)
  listing each published Notion doc: its URL, what it covers, and the date.
- Append a `## [YYYY-MM-DD] publish | <docs>` entry to `log.md` with the Notion
  URL(s) and the outline published.
- Commit (and push if a remote is configured).

## 6. Report

Give the user the live Notion link(s) and a one-line summary of what shipped and
what was intentionally left out.

## Guardrails

- **Curate, don't dump.** If the user truly wants everything, that's a different
  ask — confirm. The default is a readable core.
- **Confirm before any outward-facing write**, and before overwriting an existing
  published doc.
- If the Notion MCP isn't configured, say so and offer to produce the curated
  document as markdown in the repo (e.g. under a `publish/` folder) for the user to
  paste in manually.
