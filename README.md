# project-wiki

A boilerplate for building an **agent-maintained knowledge base** — a durable,
cross-linked synthesis of a problem space, assembled out of whatever raw material
you can point it at (docs, meeting transcripts, web pages, design files, pasted
notes), and browsable in a local viewer with inline comments.

It's a generalized, from-scratch version of the three-layer "[LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)"
pattern: faithful **sources**, an AI-maintained **wiki** synthesis on top, and a
small **schema** that tells the agent how it all fits together.

## Quickstart

1. **Copy this repo** to a new project directory and open it in Claude Code (or
   any agent that reads `AGENTS.md`).
2. **Run `/wiki-setup`.** It asks what the project is, who it's for, and whether
   you have any starting material — then fills in the manuals, brands the viewer,
   and ingests anything you hand it.
3. **Feed it material** with `/wiki-ingest` (a Notion link, a meeting transcript,
   a web page, a PDF, pasted notes…). Each source is captured faithfully, then
   fanned out into the wiki.
4. **Deepen it** with `/wiki-research` — it proposes a menu of research options
   and runs the ones you choose.
5. **Read and comment** in the viewer (below). Your highlights come back to the
   agent as feedback.
6. **Publish** the core concepts as Notion document(s) with `/wiki-publish`.

## The skills

| Skill | What it does |
| --- | --- |
| `/wiki-setup` | Interactive first-time bootstrap. |
| `/wiki-ingest` | Capture a new source (Notion, Figma, transcript, web, file, paste), then update the wiki. |
| `/wiki-research` | Interactive, menu-driven research into core concepts and external references. |
| `/wiki-publish` | Publish a curated subset of the wiki as Notion document(s). |
| `/wiki-query` | Ask the wiki a question; non-trivial answers get filed back. |
| `/wiki-lint` | Health-check: contradictions, stale claims, orphans, missing links. |
| `/wiki-diagram` | Keep the mermaid model diagram(s) in sync with the wiki. |

The skills live in `.claude/skills/`. Each `SKILL.md` is also a plain runbook any
agent can follow by hand.

## Structure

```
.
├── CLAUDE.md / AGENTS.md   # operating manual (the "schema" layer)
├── README.md               # this file
├── log.md                  # append-only record of every operation
├── sources/                # faithful captures of external material
├── wiki/                   # the synthesis layer (entities, concepts, decisions, …)
├── annotations/            # your highlights + comments from the viewer
├── _templates/             # source + wiki page templates
└── viewer/                 # Astro web viewer
```

- **`sources/`** is for faithful capture — one file per source, `url` in
  frontmatter, mostly immutable.
- **`wiki/`** is for synthesis — cross-source connections, definitions, decisions,
  open questions, interlinked with viewer URLs.
- Don't synthesize in `sources/`; synthesize in `wiki/`.

## Running the viewer

```bash
cd viewer
npm install
npm run dev
```

Open `http://localhost:4321/`. The viewer:

- **Flattens** `sources/` and `wiki/` into namespaced slugs (`wiki/concepts/x.md`
  → `/wiki-concepts-x/`); cross-links in markdown use these URLs.
- **Auto-generates the sidebar** from your pages on every `npm run sync` (which
  `npm run dev` runs first) — new pages appear with no manual nav editing.
  Labels come from each page's `title`; optional `badge:` / `order:` frontmatter
  tune the pill and sort order.
- **Renders mermaid** diagrams.
- **Annotations:** highlight any text and attach a comment. Comments are stored as
  `annotations/<slug>.json` and are the primary way to give the agent feedback on
  specific passages. (The annotation API runs in `npm run dev` only.)

## How it's meant to be used

The highest-leverage way to work with the material is **with an agent pointed at
the repo**. Ask it questions and it stitches answers across entity pages,
decisions, and open questions far faster than reading the tree by hand. The
operating manuals brief any agent on the conventions automatically. Use the
viewer when you want to read or comment rather than ask.
