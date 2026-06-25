# project-wiki

A boilerplate for an **agent-maintained knowledge base**. Point an agent at scattered
material — docs, meeting transcripts, web pages, design files, pasted notes — and it
builds a durable, cross-linked synthesis you can browse, comment on, and publish.

It's a generalized version of Karpathy's three-layer "[LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)"
pattern:

- **`sources/`** — faithful captures of raw material (one file per source, mostly immutable).
- **`wiki/`** — the agent-maintained synthesis: interlinked entities, concepts, decisions, open questions.
- **`CLAUDE.md` / `AGENTS.md`** — the schema: conventions and operations the agent follows.

The best way to use the result is to keep asking the agent questions — it stitches
answers across the wiki far faster than reading the tree by hand. A local viewer is
there for when you'd rather read or comment.

## Quickstart

1. **Use this template** (or clone it), then open the copy in [Claude Code](https://claude.com/claude-code).
2. **`/wiki-setup`** — interactive bootstrap: names the project, brands the viewer, ingests any starting material.
3. **`/wiki-ingest`** — feed it a source (Notion link, transcript, web page, PDF, paste). Captured faithfully, then fanned out into the wiki.
4. **`/wiki-research`** — proposes a menu of research options; runs the ones you pick.
5. **`/wiki-publish`** — publishes the core concepts as curated Notion document(s).

## Skills

Skills live in `.claude/skills/`. Invoke by name, or just describe the task. Each
`SKILL.md` doubles as a plain runbook any agent can follow by hand.

| Skill | What it does |
| --- | --- |
| `/wiki-setup` | Interactive first-time bootstrap. |
| `/wiki-ingest` | Capture a source (Notion, Figma, transcript, web, file, paste), then update the wiki. |
| `/wiki-research` | Interactive, menu-driven research into core concepts and external references. |
| `/wiki-publish` | Publish a curated subset of the wiki as Notion document(s). |
| `/wiki-query` | Ask the wiki a question; non-trivial answers get filed back. |
| `/wiki-lint` | Health-check: contradictions, stale claims, orphans, missing links. |
| `/wiki-diagram` | Keep the mermaid model diagram(s) in sync with the wiki. |

## Viewer

```bash
cd viewer
npm install
npm run dev        # → http://localhost:4321/
```

- **Auto-generated sidebar** from your pages' frontmatter on every sync — new pages appear with no manual nav editing.
- **Mermaid** diagrams render inline.
- **Annotations** — highlight any text and attach a comment (`annotations/<slug>.json`); it's the primary way to give the agent feedback on specific passages. (Annotation API runs in `npm run dev` only.)

## Layout

```
CLAUDE.md / AGENTS.md   # operating manual (the "schema" layer)
log.md                  # append-only record of every operation
sources/                # faithful captures of external material
wiki/                   # the synthesis layer
annotations/            # highlights + comments from the viewer
_templates/             # source + wiki page templates
viewer/                 # Astro web viewer
```

Rule of thumb: **capture in `sources/`, synthesize in `wiki/`.**

## Requirements

- [Claude Code](https://claude.com/claude-code) (or any agent that reads `AGENTS.md`).
- Node.js for the viewer.
- Optional MCP servers for richer ingest/publish: Notion, Figma, a transcript source (e.g. Fireflies), Context7. Everything degrades gracefully when one isn't configured.

## License

MIT — see [LICENSE](LICENSE).
