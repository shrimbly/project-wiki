# {{PROJECT_NAME}}

<!-- This block is filled in by `/wiki-setup`. Until then it holds placeholders. -->

## Project

- **What this is:** {{PROJECT_DESCRIPTION}}
- **Deliverable:** {{PROJECT_DELIVERABLE}}
- **Audience:** {{PROJECT_AUDIENCE}}
- **Owner:** {{PROJECT_OWNER}}

> New here? This is a **project-wiki**: an agent-maintained knowledge base that
> turns scattered source material into a durable, cross-linked synthesis. If the
> placeholders above are still `{{...}}`, run `/wiki-setup` first.

## What a project-wiki is

A working repository for building a precise, shared understanding of a problem
space — its entities, concepts, decisions, and open questions — out of whatever
raw material you can point it at (docs, meeting transcripts, web pages, design
files, pasted notes). The agent keeps the synthesis current and consistent as
new material lands, and can publish the core of it back out as clean documents.

## Architecture

Three layers, inspired by [Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f):

1. **Sources** (`sources/`) — faithful captures of external material. One file
   per source, original URL preserved in frontmatter so we can always re-fetch.
   Sources are mostly immutable — edited only to fix mistakes.

2. **Wiki** (`wiki/`) — the persistent synthesis layer. Markdown pages, owned by
   the agent, that compile, cross-link, and keep current the understanding
   extracted from sources. Entity pages, concept pages, decisions, open
   questions. New sources update existing wiki pages; substantive questions can
   produce new pages.

3. **Schema** (this file) — the operating manual. How the wiki is structured,
   what the conventions are, and how each operation works.

The viewer (`viewer/`) renders both sources and wiki for browsing + commenting
via annotations.

## Repo layout

```
{{PROJECT_SLUG}}/
├── CLAUDE.md              # this file — operating manual (Claude)
├── AGENTS.md              # operating manual for other agents (Codex, etc.)
├── README.md             # human-facing intro + quickstart
├── log.md                # append-only chronological record of operations
├── sources/              # faithful captures of external material
│   ├── INDEX.md          # one-line pointer to each source
│   ├── <slug>.md         # per-source capture
│   └── assets/           # binary assets (images, diagrams)
├── wiki/                 # synthesis layer — agent-owned, interlinked
│   ├── index.md          # wiki page catalog
│   ├── overview.md       # top-level synthesis (the project in one page)
│   ├── open-questions.md # rolling list of unresolved items
│   ├── entities/         # one page per entity
│   ├── concepts/         # one page per cross-cutting concept
│   ├── decisions/        # ADR-style notes for decisions made
│   ├── diagrams/         # mermaid diagrams of the model
│   └── references/       # external / competitive captures used as input
├── annotations/          # user highlights + comments captured in the viewer
│   └── <slug>.json
├── _templates/           # source + wiki page templates
└── viewer/               # Astro web viewer
```

Directories are created on first use — don't pre-create empty ones.

## Skills

The operations below are packaged as skills in `.claude/skills/`. Invoke them by
name (e.g. `/wiki-ingest`) or just describe the task — the skill descriptions
route it. Each skill's `SKILL.md` is also a plain runbook any agent can follow.

| Skill | Use it when |
| --- | --- |
| `wiki-setup` | First-time bootstrap of a fresh project-wiki — interactive: captures what the project is, who it's for, and any starting material. |
| `wiki-ingest` | New source material arrives (Notion, Figma, a meeting transcript, a web page, a local file, pasted text). Captures it faithfully, then fans out into the wiki. |
| `wiki-research` | You want to deepen the wiki on a core concept or external reference. Interactive: proposes a menu of research options and runs the ones you pick. |
| `wiki-publish` | You want to publish the core concepts back out as Notion document(s) — a curated subset, not every page. |
| `wiki-query` | You have a substantive question for the wiki. Answers with citations and files non-trivial answers back. |
| `wiki-lint` | Periodic health-check: contradictions, stale claims, orphans, missing cross-refs, resolved open questions. |
| `wiki-diagram` | Keep the mermaid model diagram(s) in `wiki/diagrams/` in sync with the entity/concept pages. |

## Operations (reference)

### Ingest

When a new source lands:

1. **Pull fresh from source** (Notion MCP / Figma MCP / Fireflies MCP / WebFetch /
   Read). Don't paraphrase from memory.
2. Write `sources/<slug>.md` per the [source-file convention](#source-file-conventions).
   Capture verbatim claims; flag conflicts and open questions inline at the bottom.
3. Update `sources/INDEX.md` with a one-liner.
4. **Fan out into the wiki**: update every wiki page the source touches. A single
   source often updates 3–10 pages. New entities/concepts may warrant new pages.
   New unresolved items go into `wiki/open-questions.md`.
5. Update `wiki/index.md` if pages were added.
6. Append a `## [YYYY-MM-DD] ingest | <title>` entry to `log.md`.

### Query

When the user asks a substantive question:

1. Read `wiki/index.md` first to find relevant pages, then drill in.
2. If the wiki has the answer, cite the page(s); if not, fall back to sources.
3. **If the answer is non-trivial, file it back into the wiki** — a comparison, a
   connection, an analysis is worth a new page or an update.
4. Append a `## [YYYY-MM-DD] query | <topic>` entry to `log.md` if the wiki changed.

### Lint

Periodically health-check the wiki: contradictions between pages, stale claims
superseded by newer sources, orphan pages with no inbound links, important
concepts in sources but lacking a page, missing cross-references, resolved
open-questions still listed as open. Append a `## [YYYY-MM-DD] lint | <scope>`
entry to `log.md`.

## How to work

- **Fluid planning, concrete artifacts.** Don't lock the shape of the final
  deliverable up front. Do keep every intermediate artifact concrete and durable.
- **Always pull fresh from source.** External tools are ground truth. Re-fetch
  rather than relying on cached interpretation. If you find yourself paraphrasing
  from memory, stop and re-fetch.
- **Don't synthesize in `sources/`. Synthesize in `wiki/`.** First pass on any
  source is faithful capture with claims attributed. Cross-source synthesis lives
  in the wiki.
- **Every claim cites a source.** Wiki pages link back to the `sources/` files
  they derive from.
- **Commit at natural stopping points.** After an ingest, a research round, a
  lint, or a publish, commit (and push if a git remote is configured).

## MCP servers

Prefer these over generic web fetching for their domains, when configured:

- **Notion** — read source pages; publish curated docs back out (`/wiki-publish`).
- **Figma** — design files and FigJam boards.
- **Fireflies** (or similar) — meeting transcripts and summaries.
- **Context7** — current library / framework / API documentation during research.

Not every server is configured in every environment — fall back to WebFetch /
WebSearch / Read / pasted text when one is missing.

## User feedback via annotations

The viewer (`viewer/`, Astro at `localhost:4321` via `npm run dev`) lets the user
highlight text in any source or wiki doc and attach a comment. **Read these on
every session** — they're the user's primary way of pointing out where the
captured material is wrong, surprising, important, or needs follow-up.

- Storage: `annotations/<slug>.json`, where `<slug>` matches the synced filename
  the viewer uses (e.g. `wiki-entities-workspace.json` for `wiki/entities/workspace.md`,
  or `notion-foo.json` for `sources/notion-foo.md`).
- Each annotation has `quote` (highlighted text), `prefix`/`suffix` (~40 chars of
  surrounding context), `comment`, `id`, `createdAt`.
- To act on a comment: search the underlying markdown for `quote` (use
  prefix/suffix to disambiguate), then edit the source or wiki page. Don't delete
  the annotation — let the viewer's orphan indicator surface that it's resolved.

Quick check at session start: `ls annotations/*.json 2>/dev/null` then read any
non-empty files.

## Source file conventions

Each `sources/<slug>.md`. Slugs are `<type>-<topic>`, e.g. `notion-permissions`,
`meeting-2026-05-08-kickoff`, `web-competitor-pricing`, `doc-prd-v2`.

```markdown
---
title: <title>
url: <canonical url or origin>
type: notion | figma | meeting | web | doc | image | note | research | other
fetched: YYYY-MM-DD
parent: <parent slug>.md      # if hierarchical
---

## What it contains
<one paragraph>

## <body — faithful capture of claims; verbatim quotes where useful>

## Conflicts / open questions
<flag conflicts, ambiguities, missing pieces>
```

`sources/INDEX.md` is a flat list of one-liners pointing at each entry. Keep it current.

## Wiki page conventions

```markdown
---
title: <title>
type: entity | concept | decision | overview | open-questions | index | diagram | reference
status: draft | living | settled
badge: <optional short label>     # shows as a sidebar pill, e.g. "draft", "future"
order: <optional number>          # optional sidebar sort key within its section
sources:                          # source files this page derives from
  - notion-foo.md
related:                          # other wiki pages
  - entities/bar.md
---

## Summary
<one short paragraph; the page in ~50 words>

## <body sections — page-specific>

## Sources
- [`notion-foo`](/notion-foo/)

## Related
- [`Bar`](/wiki-entities-bar/)
```

**Cross-link convention.** Inside the body, link to other wiki pages and source
pages using **viewer URLs** — `/wiki-entities-bar/`, `/notion-foo/`. The viewer
flattens the `wiki/` tree into namespaced slugs (`wiki-<dir>-<file>`), so
relative `.md` paths don't resolve there. Trade-off: less Obsidian-like in raw
markdown, fully clickable in the viewer.

**`status` field** signals freshness:
- `draft` — early scaffold, expect rewrites.
- `living` — actively updated as new sources arrive.
- `settled` — captures something that won't change.

**Sidebar.** The viewer sidebar is generated automatically from these files
(grouped by `wiki/` subdirectory and `sources/`), using `title` for the label and
the optional `badge` / `order` fields. New pages appear on the next `npm run sync`
(which `npm run dev` runs for you) — no manual nav editing.

## Definition of done (working assumption)

- Every entity in the model has a `wiki/entities/<name>.md` covering: purpose,
  identity, relationships, lifecycle (and permission semantics, if relevant).
- Every cross-cutting concept has a `wiki/concepts/<name>.md` page.
- Every non-obvious modeling choice has a `wiki/decisions/<name>.md` page.
- Every claim in the wiki cites at least one source.
- Diagram(s) and wiki don't contradict each other.

This is provisional — refine as the work clarifies.
